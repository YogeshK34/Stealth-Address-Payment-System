import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stealthClient } from '@/lib/stealthClient';
import { prisma } from '@/lib/prisma';

// ERC5564Announcer contract address (override via env for non-mainnet).
const ERC5564_ADDRESS =
  (process.env.ERC5564_ANNOUNCER_ADDRESS as `0x${string}`) ??
  '0x55649E01B5Df198D18D95b5cc5051630cfD45564';

const scanSchema = z.object({
  walletId: z
    .string()
    .trim()
    .regex(/^(c[a-z0-9]{8,}|[0-9a-fA-F-]{36})$/, 'Invalid wallet id format'),
});

const scanQuerySchema = z.object({
  walletId: z
    .string()
    .trim()
    .regex(/^(c[a-z0-9]{8,}|[0-9a-fA-F-]{36})$/, 'Invalid wallet id format')
    .optional(),
});

type WalletKeysRow = {
  id: string;
  public_spend_key: string;
  encrypted_view_priv_key: string;
};

type DetectedPaymentRow = {
  id: string;
  wallet_id: string;
  tx_hash: string;
  one_time_address: string;
  ephemeral_public_key: string;
  amount_sats: number;
  created_at: Date | string;
};

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// POST /api/v1/scan — trigger on-demand ERC-5564 announcement scan via SDK
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJsonBody(request);
  const parsed = scanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid request body.',
        },
      },
      { status: 400 }
    );
  }

  const walletRows = await prisma.$queryRaw<WalletKeysRow[]>(
    `SELECT id, public_spend_key, encrypted_view_priv_key
    FROM wallets
    WHERE id = '${parsed.data.walletId}'
    LIMIT 1`
  );

  const wallet = walletRows[0];

  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found.' } },
      { status: 404 }
    );
  }

  try {
    const detected: DetectedPaymentRow[] = [];

    // Use SDK to watch on-chain ERC-5564 announcements for this user.
    // watchAnnouncementsForUser polls the ERC5564Announcer contract and filters
    // announcements that match the user's viewing private key + spending public key.
    const unwatch = await stealthClient.watchAnnouncementsForUser({
      ERC5564Address: ERC5564_ADDRESS,
      args: {},
      spendingPublicKey: wallet.public_spend_key as `0x${string}`,
      viewingPrivateKey: wallet.encrypted_view_priv_key as `0x${string}`, // caller must decrypt before storing
      handleLogsForUser: async (logs) => {
        for (const log of logs) {
          const ephemeralPublicKey = log.ephemeralPubKey as string | undefined;
          const stealthAddress = log.stealthAddress as string | undefined;
          const txHash = log.transactionHash ?? '';

          if (!ephemeralPublicKey || !stealthAddress || !txHash) continue;

          // Deduplicate by tx_hash.
          const existing = await prisma.$queryRaw<Array<{ id: string }>>(
            `SELECT id
            FROM detected_payments
            WHERE tx_hash = '${txHash}'
            LIMIT 1`
          );

          if (existing.length === 0) {
            const paymentRows = await prisma.$queryRaw<DetectedPaymentRow[]>(
              `INSERT INTO detected_payments (
                wallet_id,
                tx_hash,
                one_time_address,
                ephemeral_public_key,
                amount_sats
              )
              VALUES (
                '${wallet.id}',
                '${txHash}',
                '${stealthAddress}',
                '${ephemeralPublicKey}',
                0
              )
              RETURNING id, wallet_id, tx_hash, one_time_address, ephemeral_public_key, amount_sats, created_at`
            );

            if (paymentRows[0]) detected.push(paymentRows[0]);
          }
        }
      },
      // Poll once then unwatch – suitable for on-demand endpoint.
      pollOptions: { pollingInterval: 0 },
    });

    // Stop watching after the first poll cycle.
    if (typeof unwatch === 'function') unwatch();

    return NextResponse.json({
      data: {
        walletId: wallet.id,
        detectedPayments: detected,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[POST /api/v1/scan]', err);
    return NextResponse.json(
      { error: { code: 'SCAN_FAILED', message: 'Scan failed.' } },
      { status: 500 }
    );
  }
}

// GET /api/v1/scan — list detected payments
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const parsedQuery = scanQuerySchema.safeParse({
    walletId: searchParams.get('walletId') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsedQuery.error.issues[0]?.message ?? 'Invalid query parameters.',
        },
      },
      { status: 400 }
    );
  }

  const walletId = parsedQuery.data.walletId;

  try {
    let payments: DetectedPaymentRow[];

    if (walletId) {
      payments = await prisma.$queryRaw<DetectedPaymentRow[]>(
        `SELECT id, wallet_id, tx_hash, one_time_address, ephemeral_public_key, amount_sats, created_at
        FROM detected_payments
        WHERE wallet_id = '${walletId}'
        ORDER BY created_at DESC`
      );
    } else {
      payments = await prisma.$queryRaw<DetectedPaymentRow[]>(
        `SELECT id, wallet_id, tx_hash, one_time_address, ephemeral_public_key, amount_sats, created_at
        FROM detected_payments
        ORDER BY created_at DESC`
      );
    }

    return NextResponse.json({ data: payments, meta: { timestamp: new Date().toISOString() } });
  } catch (error) {
    console.error('[GET /api/v1/scan]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch detected payments.' } },
      { status: 500 }
    );
  }
}
