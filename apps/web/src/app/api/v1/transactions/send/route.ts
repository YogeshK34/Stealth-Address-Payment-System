import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateStealthAddress, VALID_SCHEME_ID } from '@scopelift/stealth-address-sdk';
import { stealthClient } from '@/lib/stealthClient';
import { getBitGoCoin } from '@/lib/bitgo';
import { prisma } from '@/lib/prisma';

// ERC5564Announcer contract address (Sepolia / mainnet address from the ERC-5564 spec).
// Override via env var for other networks.
const ERC5564_ADDRESS =
  (process.env.ERC5564_ANNOUNCER_ADDRESS as `0x${string}`) ??
  '0x55649E01B5Df198D18D95b5cc5051630cfD45564';

const sendSchema = z.object({
  senderWalletId: z
    .string()
    .trim()
    .regex(/^(c[a-z0-9]{8,}|[0-9a-fA-F-]{36})$/, 'Invalid sender wallet id'),
  // ERC-5564 meta-address URI: st:<chain>:0x<132-hex>
  receiverStealthMetaAddressURI: z
    .string()
    .regex(/^st:[a-zA-Z0-9]+:0x[0-9a-fA-F]{132}$/, 'Invalid ERC-5564 stealth meta-address URI'),
  amountSats: z.number().int().positive(),
  walletPassphrase: z.string().min(1),
  // Ethereum sender address for the ERC-5564 announcement (optional – skipped if absent).
  senderAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
});

type WalletRow = {
  id: string;
  bitgo_wallet_id: string;
  network: string;
};

type TxRow = {
  tx_hash: string;
  amount_sats: number;
  status: string;
  one_time_address: string | null;
  ephemeral_public_key: string | null;
};

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// POST /api/v1/transactions/send
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJsonBody(request);
  const parsed = sendSchema.safeParse(body);
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

  const {
    senderWalletId,
    receiverStealthMetaAddressURI,
    amountSats,
    walletPassphrase,
    senderAddress,
  } = parsed.data;

  const walletRows = await prisma.$queryRaw<WalletRow[]>(
    `SELECT id, bitgo_wallet_id, network
    FROM wallets
    WHERE id = '${senderWalletId}'
    LIMIT 1`
  );

  const wallet = walletRows[0];
  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Sender wallet not found.' } },
      { status: 404 }
    );
  }

  try {
    // 1. Derive ERC-5564 one-time stealth address via SDK.
    const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress({
      stealthMetaAddressURI: receiverStealthMetaAddressURI,
    });

    // 2. Prepare ERC-5564 announcement payload (non-blocking; failure doesn't abort send).
    let announcePayload: Awaited<ReturnType<typeof stealthClient.prepareAnnounce>> | null = null;
    if (senderAddress) {
      try {
        // metadata = viewTag byte prefixed with 0x01 (ERC-5564 scheme 1 convention).
        const metadata = `0x01${viewTag.replace(/^0x/, '')}` as `0x${string}`;
        announcePayload = await stealthClient.prepareAnnounce({
          account: senderAddress as `0x${string}`,
          ERC5564Address: ERC5564_ADDRESS,
          args: {
            schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
            stealthAddress,
            ephemeralPublicKey,
            metadata,
          },
        });
      } catch (announceErr) {
        console.warn('[prepareAnnounce] Could not prepare announce payload:', announceErr);
      }
    }

    // 3. Broadcast via BitGo.
    const coin = await getBitGoCoin(wallet.network);
    const senderWallet = await coin.wallets().get({ id: wallet.bitgo_wallet_id });

    const bitgoResult = await (
      senderWallet as {
        sendMany: (options: {
          recipients: Array<{ address: string; amount: string }>;
          walletPassphrase: string;
          comment?: string;
          label?: string;
        }) => Promise<{ txid: string; status?: string }>;
      }
    ).sendMany({
      recipients: [{ address: stealthAddress, amount: String(amountSats) }],
      walletPassphrase,
      comment: `stealth:ephemeral:${ephemeralPublicKey}`,
      label: ephemeralPublicKey,
    });

    // 4. Record transaction metadata.
    const txRows = await prisma.$queryRaw<TxRow[]>(
      `INSERT INTO transactions (
        wallet_id,
        tx_hash,
        direction,
        amount_sats,
        ephemeral_public_key,
        one_time_address,
        status
      )
      VALUES (
        '${wallet.id}',
        '${bitgoResult.txid}',
        'send',
        ${amountSats},
        '${ephemeralPublicKey}',
        '${stealthAddress}',
        'pending'
      )
      RETURNING tx_hash, amount_sats, status, one_time_address, ephemeral_public_key`
    );

    const tx = txRows[0];
    if (!tx) throw new Error('Failed to record transaction');

    return NextResponse.json(
      {
        data: {
          txHash: tx.tx_hash,
          stealthAddress: tx.one_time_address,
          ephemeralPublicKey: tx.ephemeral_public_key,
          viewTag,
          amountSats: tx.amount_sats,
          status: tx.status,
          ...(announcePayload ? { announcePayload } : {}),
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/v1/transactions/send]', err);
    return NextResponse.json(
      { error: { code: 'TX_BUILD_FAILED', message: 'Transaction failed.' } },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to send transactions.' } },
    { status: 405 }
  );
}
