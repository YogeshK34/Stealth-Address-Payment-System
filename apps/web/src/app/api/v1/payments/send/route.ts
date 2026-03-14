import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBitGoCoin } from '@/lib/bitgo';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@stealth/db';

const sendSchema = z.object({
  senderWalletId: z.string().trim().min(1, 'senderWalletId is required'),
  stealthAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid stealth address'),
  ephemeralPublicKey: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid ephemeral public key'),
  viewTag: z.string().regex(/^0x[0-9a-fA-F]{1,4}$/, 'Invalid view tag'),
  amountSats: z.number().int().positive('amountSats must be a positive integer'),
  walletPassphrase: z.string().min(1, 'Wallet passphrase is required'),
});

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// POST /api/v1/payments/send
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

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
    stealthAddress,
    ephemeralPublicKey,
    viewTag,
    amountSats,
    walletPassphrase,
  } = parsed.data;

  const admin = getSupabaseAdmin();

  // Verify wallet exists and belongs to the authenticated user.
  const { data: wallet, error: walletErr } = await admin
    .from('wallets')
    .select('id, wallet_id, network, user_id')
    .or(`id.eq.${senderWalletId},wallet_id.eq.${senderWalletId}`)
    .limit(1)
    .maybeSingle();

  if (walletErr || !wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Sender wallet not found.' } },
      { status: 404 }
    );
  }

  const walletData = wallet as { id: string; wallet_id: string; network: string; user_id: string };

  if (walletData.user_id !== auth.userId) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Wallet does not belong to the authenticated user.',
        },
      },
      { status: 403 }
    );
  }

  try {
    // 1. Send funds via BitGo.
    const coin = await getBitGoCoin(walletData.network);
    const senderWallet = await coin.wallets().get({ id: walletData.wallet_id });

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

    // 2. Store transaction record via Supabase.
    const { data: tx, error: txErr } = await admin
      .from('transactions')
      .insert({
        wallet_id: walletData.id,
        tx_hash: bitgoResult.txid,
        direction: 'send' as const,
        amount_sats: amountSats,
        ephemeral_public_key: ephemeralPublicKey,
        one_time_address: stealthAddress,
        status: 'pending' as const,
      })
      .select('id, tx_hash, amount_sats, status, one_time_address, ephemeral_public_key')
      .single();

    if (txErr || !tx) {
      console.error('[payments/send] Failed to store transaction:', txErr);
      // Transaction was already sent — still return success with BitGo data.
      return NextResponse.json(
        {
          data: {
            txHash: bitgoResult.txid,
            stealthAddress,
            ephemeralPublicKey,
            viewTag,
            amountSats,
            status: 'pending',
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 201 }
      );
    }

    const txData = tx as {
      id: string;
      tx_hash: string;
      amount_sats: number;
      status: string;
      one_time_address: string | null;
      ephemeral_public_key: string | null;
    };

    return NextResponse.json(
      {
        data: {
          txHash: txData.tx_hash,
          stealthAddress: txData.one_time_address,
          ephemeralPublicKey: txData.ephemeral_public_key,
          viewTag,
          amountSats: txData.amount_sats,
          status: txData.status,
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/v1/payments/send]', err);
    return NextResponse.json(
      { error: { code: 'TX_BUILD_FAILED', message: 'Transaction failed.' } },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to send payments.' } },
    { status: 405 }
  );
}
