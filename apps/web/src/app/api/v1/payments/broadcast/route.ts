import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@stealth/db';

const broadcastSchema = z.object({
  walletId: z.string().trim().min(1, 'walletId is required'),
  // Pre-signed raw transaction hex from the client.
  rawTxHex: z
    .string()
    .regex(/^[0-9a-fA-F]+$/, 'rawTxHex must be valid hex')
    .min(20),
  // Metadata for recording the sweep in the DB.
  oneTimeAddress: z.string().min(14, 'Invalid oneTimeAddress'),
  originalTxHash: z.string().min(10, 'Invalid originalTxHash'),
  amountSats: z.number().int().positive('amountSats must be a positive integer'),
  feeSats: z.number().int().nonnegative('feeSats must be non-negative'),
});

const ENDPOINTS = {
  mainnet: ['https://blockstream.info/api', 'https://mempool.space/api'],
  testnet: ['https://blockstream.info/testnet/api', 'https://mempool.space/testnet/api'],
};

function broadcastEndpoints(): string[] {
  return process.env.BITGO_COIN === 'btc' ? ENDPOINTS.mainnet : ENDPOINTS.testnet;
}

async function broadcastRawTx(rawTxHex: string): Promise<string> {
  const endpoints = broadcastEndpoints();
  let lastErr = '';
  for (const base of endpoints) {
    try {
      const res = await fetch(`${base}/tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: rawTxHex,
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return (await res.text()).trim();
      lastErr = await res.text().catch(() => `HTTP ${res.status}`);
      console.warn(`[broadcast] ${base} rejected tx: ${lastErr}`);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[broadcast] ${base} unreachable: ${lastErr}`);
    }
  }
  throw new Error(lastErr || 'All broadcast endpoints failed');
}

// POST /api/v1/payments/broadcast
//
// Accepts a client-signed raw transaction hex and broadcasts it to the Bitcoin
// network via Blockstream. No private key is involved — the signing happened
// entirely in the browser.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be JSON.' } },
      { status: 400 }
    );
  }

  const parsed = broadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid request.',
        },
      },
      { status: 400 }
    );
  }

  const { walletId, rawTxHex, oneTimeAddress, originalTxHash, amountSats, feeSats } = parsed.data;
  const admin = getSupabaseAdmin();

  // Verify wallet ownership.
  const { data: wallet } = await (admin as any)
    .from('wallets')
    .select('id, user_id')
    .or(`id.eq.${walletId},wallet_id.eq.${walletId}`)
    .limit(1)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found.' } },
      { status: 404 }
    );
  }

  if ((wallet as { user_id: string }).user_id !== auth.userId) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Wallet does not belong to this user.' } },
      { status: 403 }
    );
  }

  // Broadcast to Bitcoin network (tries multiple endpoints).
  let sweepTxHash: string;
  try {
    sweepTxHash = await broadcastRawTx(rawTxHex);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[broadcast] All endpoints failed:', msg);
    return NextResponse.json(
      { error: { code: 'BROADCAST_FAILED', message: `Transaction broadcast failed: ${msg}` } },
      { status: 502 }
    );
  }

  // Record the sweep (direction='receive') and mark the original send as swept.
  try {
    await Promise.all([
      (admin as any).from('transactions').insert({
        wallet_id: (wallet as { id: string }).id,
        tx_hash: sweepTxHash,
        direction: 'receive',
        amount_sats: amountSats,
        one_time_address: oneTimeAddress,
        status: 'pending',
      }),
      (admin as any).from('transactions').update({ status: 'swept' }).eq('tx_hash', originalTxHash),
    ]);
  } catch (dbErr) {
    // Transaction is already broadcast — log but don't fail the response.
    console.error('[broadcast] DB record error (tx already sent):', dbErr);
  }

  return NextResponse.json(
    {
      data: {
        sweepTxHash,
        oneTimeAddress,
        amountSats,
        feeSats,
        status: 'pending',
      },
      meta: { timestamp: new Date().toISOString() },
    },
    { status: 201 }
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to broadcast a transaction.' } },
    { status: 405 }
  );
}
