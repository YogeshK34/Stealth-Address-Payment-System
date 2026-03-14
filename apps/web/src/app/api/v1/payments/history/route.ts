import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@stealth/db';

const querySchema = z.object({
  walletId: z.string().trim().min(1, 'walletId must not be empty').optional(),
});

// GET /api/v1/payments/history
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    walletId: searchParams.get('walletId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid query parameters.',
        },
      },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  try {
    if (parsed.data.walletId) {
      const walletId = parsed.data.walletId;

      // Verify the wallet belongs to the authenticated user.
      const { data: walletRow } = await admin
        .from('wallets')
        .select('user_id')
        .or(`id.eq.${walletId},wallet_id.eq.${walletId}`)
        .limit(1)
        .maybeSingle();

      if (walletRow && (walletRow as { user_id?: string }).user_id !== auth.userId) {
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

      // Fetch transactions for this specific wallet.
      const { data: payments, error: txErr } = await admin
        .from('transactions')
        .select(
          'id, wallet_id, one_time_address, ephemeral_public_key, amount_sats, tx_hash, status, created_at'
        )
        .eq('wallet_id', walletRow?.id ?? walletId)
        .eq('direction', 'send')
        .order('created_at', { ascending: false });

      if (txErr) throw txErr;

      return NextResponse.json({
        data: formatPayments(payments ?? []),
        meta: { timestamp: new Date().toISOString() },
      });
    }

    // No walletId filter — get all user's wallet IDs first, then their transactions.
    const { data: userWallets } = await admin
      .from('wallets')
      .select('id')
      .eq('user_id', auth.userId);

    const walletIds = (userWallets ?? []).map((w) => (w as { id: string }).id);

    if (walletIds.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const { data: payments, error: txErr } = await admin
      .from('transactions')
      .select(
        'id, wallet_id, one_time_address, ephemeral_public_key, amount_sats, tx_hash, status, created_at'
      )
      .in('wallet_id', walletIds)
      .eq('direction', 'send')
      .order('created_at', { ascending: false });

    if (txErr) throw txErr;

    return NextResponse.json({
      data: formatPayments(payments ?? []),
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[GET /api/v1/payments/history]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment history.' } },
      { status: 500 }
    );
  }
}

function formatPayments(rows: Record<string, unknown>[]) {
  return rows.map((p) => ({
    id: p.id,
    walletId: p.wallet_id,
    stealthAddress: p.one_time_address,
    ephemeralPublicKey: p.ephemeral_public_key,
    amountSats: p.amount_sats,
    txHash: p.tx_hash,
    status: p.status,
    createdAt: p.created_at,
  }));
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET for payment history.' } },
    { status: 405 }
  );
}
