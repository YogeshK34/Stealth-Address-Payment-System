import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@stealth/db';
import { checkTxStatuses } from '@/lib/tx-status';

const querySchema = z.object({
  walletId: z.string().trim().min(1, 'walletId must not be empty').optional(),
});

type TxRow = {
  id: string;
  wallet_id: string;
  one_time_address: string | null;
  ephemeral_public_key: string | null;
  amount_sats: number;
  tx_hash: string;
  direction: string;
  status: string;
  created_at: string;
};

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
    let rows: TxRow[] = [];

    if (parsed.data.walletId) {
      const walletId = parsed.data.walletId;

      const { data: walletRow } = await (admin as any)
        .from('wallets')
        .select('id, user_id')
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

      const { data: payments, error: txErr } = await (admin as any)
        .from('transactions')
        .select(
          'id, wallet_id, one_time_address, ephemeral_public_key, amount_sats, tx_hash, direction, status, created_at'
        )
        .eq('wallet_id', walletRow?.id ?? walletId)
        .order('created_at', { ascending: false });

      if (txErr) throw txErr;
      rows = payments ?? [];
    } else {
      const { data: userWallets } = await (admin as any)
        .from('wallets')
        .select('id')
        .eq('user_id', auth.userId);

      const walletIds = (userWallets ?? []).map(
        (w: Record<string, unknown>) => (w as { id: string }).id
      );

      if (walletIds.length === 0) {
        return NextResponse.json({
          data: [],
          meta: { timestamp: new Date().toISOString() },
        });
      }

      const { data: payments, error: txErr } = await (admin as any)
        .from('transactions')
        .select(
          'id, wallet_id, one_time_address, ephemeral_public_key, amount_sats, tx_hash, direction, status, created_at'
        )
        .in('wallet_id', walletIds)
        .order('created_at', { ascending: false });

      if (txErr) throw txErr;
      rows = payments ?? [];
    }

    // ── Lazy status sync ────────────────────────────────────────────────────
    // For any transaction still marked 'pending', check Blockstream and
    // update the DB so the client always sees the current confirmation state.
    const pendingRows = rows.filter((r) => r.status === 'pending' && r.tx_hash);

    if (pendingRows.length > 0) {
      const statusResults = await checkTxStatuses(pendingRows.map((r) => r.tx_hash));

      const confirmedHashes = new Set(
        statusResults.filter((s) => s.confirmed).map((s) => s.txHash)
      );

      if (confirmedHashes.size > 0) {
        // Bulk update confirmed transactions in the DB.
        await (admin as any)
          .from('transactions')
          .update({ status: 'confirmed' })
          .in('tx_hash', [...confirmedHashes]);

        // Reflect the fresh status in the in-memory rows so the response
        // is immediately up-to-date without a second DB round-trip.
        for (const row of rows) {
          if (confirmedHashes.has(row.tx_hash)) {
            row.status = 'confirmed';
          }
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      data: formatPayments(rows),
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

function formatPayments(rows: TxRow[]) {
  return rows.map((p) => ({
    id: p.id,
    walletId: p.wallet_id,
    stealthAddress: p.one_time_address,
    ephemeralPublicKey: p.ephemeral_public_key,
    amountSats: p.amount_sats,
    txHash: p.tx_hash,
    direction: p.direction,
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
