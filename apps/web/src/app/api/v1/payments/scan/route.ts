import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deriveStealthOutput } from '@stealth/crypto';
import { getSupabaseAdmin } from '@stealth/db';
import { requireAuth } from '@/lib/auth';
import { publicKeyToBtcAddress } from '@/lib/btc-address';
import { checkTxStatuses } from '@/lib/tx-status';

const scanSchema = z.object({
  walletId: z.string().trim().min(1, 'walletId is required'),
});

// POST /api/v1/payments/scan
// Scan all recorded transactions to find which ones are addressed to this wallet's stealth keys.
// For each transaction stored in our DB that has an ephemeral_public_key, we run ECDH using
// the receiver's private view key to check whether the one_time_address matches.
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

  const parsed = scanSchema.safeParse(body);
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

  const { walletId } = parsed.data;
  const admin = getSupabaseAdmin();

  // Fetch wallet and verify ownership.
  const { data: wallet } = await (admin as any)
    .from('wallets')
    .select(
      'id, user_id, encrypted_view_priv_key, public_view_key, public_spend_key, receive_address'
    )
    .or(`id.eq.${walletId},wallet_id.eq.${walletId}`)
    .limit(1)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found.' } },
      { status: 404 }
    );
  }

  const w = wallet as {
    id: string;
    user_id: string;
    encrypted_view_priv_key: string | null;
    public_view_key: string | null;
    public_spend_key: string | null;
    receive_address: string | null;
  };

  if (w.user_id !== auth.userId) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Wallet does not belong to this user.' } },
      { status: 403 }
    );
  }

  if (!w.encrypted_view_priv_key || !w.public_spend_key) {
    return NextResponse.json(
      {
        error: {
          code: 'NO_STEALTH_KEYS',
          message: 'This wallet has no stealth keys. Generate them first.',
        },
      },
      { status: 400 }
    );
  }

  try {
    // Fetch all send transactions that have an ephemeral_public_key recorded.
    // This covers stealth payments sent through our app by any user.
    const { data: txRows, error: txErr } = await (admin as any)
      .from('transactions')
      .select(
        'id, tx_hash, ephemeral_public_key, one_time_address, amount_sats, status, created_at'
      )
      .eq('direction', 'send')
      .not('ephemeral_public_key', 'is', null)
      .not('one_time_address', 'is', null);

    if (txErr) throw txErr;

    const transactions = (txRows ?? []) as Array<{
      id: string;
      tx_hash: string;
      ephemeral_public_key: string;
      one_time_address: string;
      amount_sats: number;
      status: string;
      created_at: string;
    }>;

    const matches: Array<{
      id: string;
      txHash: string;
      oneTimeAddress: string;
      sharedSecret: string;
      amountSats: number;
      status: string;
      createdAt: string;
    }> = [];

    for (const tx of transactions) {
      try {
        // Derive the one-time pubkey from the receiver side using ECDH.
        const { oneTimePubKey, sharedSecret } = deriveStealthOutput(
          tx.ephemeral_public_key,
          w.encrypted_view_priv_key!,
          w.public_spend_key!
        );

        // Convert derived pubkey → Bitcoin address and compare to stored address.
        const derivedAddress = publicKeyToBtcAddress(oneTimePubKey);

        if (derivedAddress.toLowerCase() === tx.one_time_address.toLowerCase()) {
          matches.push({
            id: tx.id,
            txHash: tx.tx_hash,
            oneTimeAddress: tx.one_time_address,
            sharedSecret,
            amountSats: tx.amount_sats,
            status: tx.status,
            createdAt: tx.created_at,
          });
        }
      } catch {
        // Skip malformed transactions — bad key material won't crash the scan.
      }
    }

    // ── Lazy status sync for matched payments ────────────────────────────
    // Check Blockstream for any matched payments still showing 'pending' so
    // the receiver immediately sees the correct confirmation state.
    const pendingMatches = matches.filter((m) => m.status === 'pending');
    if (pendingMatches.length > 0) {
      const statusResults = await checkTxStatuses(pendingMatches.map((m) => m.txHash));
      const confirmedHashes = new Set(
        statusResults.filter((s) => s.confirmed).map((s) => s.txHash)
      );
      if (confirmedHashes.size > 0) {
        await (admin as any)
          .from('transactions')
          .update({ status: 'confirmed' })
          .in('tx_hash', [...confirmedHashes]);
        for (const match of matches) {
          if (confirmedHashes.has(match.txHash)) match.status = 'confirmed';
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      data: {
        scanned: transactions.length,
        found: matches.length,
        payments: matches,
        destinationAddress: w.receive_address,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[POST /api/v1/payments/scan]', err);
    return NextResponse.json(
      { error: { code: 'SCAN_FAILED', message: 'Failed to scan for payments.' } },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to scan for payments.' } },
    { status: 405 }
  );
}
