import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@stealth/db';
import { scanTransaction } from '@stealth/crypto';
import { getWalletTransfers } from '@stealth/bitgo-client';
import { requireAuth } from '@/lib/auth';

const scanSchema = z.object({
  walletId: z.string().cuid(),
});

// POST /api/v1/scan — trigger on-demand blockchain scan
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const body = await request.json();
  const parsed = scanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, bitgo_wallet_id, public_view_key, public_spend_key, encrypted_view_priv_key')
    .eq('id', parsed.data.walletId)
    .eq('user_id', authResult.userId)
    .single();

  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found.' } },
      { status: 404 }
    );
  }

  try {
    // Fetch recent transfers from BitGo
    const transfers = await getWalletTransfers(wallet.bitgo_wallet_id, 50);
    const detected = [];

    for (const transfer of transfers as Record<string, unknown>[]) {
      // Extract ephemeral key from tx comment/label
      const label = (transfer['label'] ?? transfer['comment'] ?? '') as string;
      const ephemeralMatch = label.match(/stealth:ephemeral:([0-9a-fA-F]{66})/);
      if (!ephemeralMatch) continue;

      const ephemeralPublicKey = ephemeralMatch[1] as string;
      const outputs = (transfer['outputs'] ?? []) as Array<{ address: string; value: number }>;

      for (const output of outputs) {
        const result = scanTransaction(
          ephemeralPublicKey,
          wallet.encrypted_view_priv_key, // TODO: decrypt before use
          { publicViewKey: wallet.public_view_key, publicSpendKey: wallet.public_spend_key },
          output.address
        );

        if (result.match) {
          const txid = transfer['txid'] as string;
          const { data: existing } = await supabase
            .from('detected_payments')
            .select('id')
            .eq('tx_hash', txid)
            .maybeSingle();

          if (!existing) {
            const { data: payment } = await supabase
              .from('detected_payments')
              .insert({
                wallet_id: wallet.id,
                tx_hash: txid,
                one_time_address: output.address,
                ephemeral_public_key: ephemeralPublicKey,
                amount_sats: output.value,
              })
              .select()
              .single();
            if (payment) detected.push(payment);
          }
        }
      }
    }

    return NextResponse.json({
      data: {
        walletId: wallet.id,
        scannedTxCount: (transfers as unknown[]).length,
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
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const walletId = searchParams.get('walletId');

  const supabase = getSupabaseAdmin();

  // First get wallet ids belonging to user, then filter detected payments
  const walletsQuery = supabase.from('wallets').select('id').eq('user_id', authResult.userId);

  const { data: userWallets } = await walletsQuery;
  const walletIds = (userWallets ?? []).map((w) => w.id);

  let query = supabase
    .from('detected_payments')
    .select('*')
    .in('wallet_id', walletIds)
    .order('created_at', { ascending: false })
    .limit(50);

  if (walletId) {
    query = query.eq('wallet_id', walletId);
  }

  const { data: payments } = await query;

  return NextResponse.json({ data: payments ?? [], meta: { timestamp: new Date().toISOString() } });
}
