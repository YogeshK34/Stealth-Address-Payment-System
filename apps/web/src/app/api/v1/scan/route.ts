import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getSupabaseAdmin,
  type DetectedPayment,
  type DetectedPaymentInsert,
  type Wallet as DbWallet,
} from '@stealth/db';
import { stealthClient } from '@/lib/stealthClient';
import { requireAuth } from '@/lib/auth';

// ERC5564Announcer contract address (override via env for non-mainnet).
const ERC5564_ADDRESS =
  (process.env.ERC5564_ANNOUNCER_ADDRESS as `0x${string}`) ??
  '0x55649E01B5Df198D18D95b5cc5051630cfD45564';

const scanSchema = z.object({
  walletId: z.string().cuid(),
});

// POST /api/v1/scan — trigger on-demand ERC-5564 announcement scan via SDK
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
  const { data: walletData } = await supabase
    .from('wallets')
    .select('id, public_view_key, public_spend_key, encrypted_view_priv_key')
    .eq('id', parsed.data.walletId)
    .eq('user_id', authResult.userId)
    .single();
  const wallet = walletData as Pick<
    DbWallet,
    'id' | 'public_view_key' | 'public_spend_key' | 'encrypted_view_priv_key'
  > | null;

  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found.' } },
      { status: 404 }
    );
  }

  try {
    const detected: DetectedPayment[] = [];

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
          const ephemeralPublicKey = log.args?.ephemeralPubKey as string | undefined;
          const stealthAddress = log.args?.stealthAddress as string | undefined;
          const txHash = log.transactionHash ?? '';

          if (!ephemeralPublicKey || !stealthAddress || !txHash) continue;

          // Deduplicate by tx_hash.
          const { data: existing } = await supabase
            .from('detected_payments')
            .select('id')
            .eq('tx_hash', txHash)
            .maybeSingle();

          if (!existing) {
            const paymentInsert: DetectedPaymentInsert = {
              wallet_id: wallet.id,
              tx_hash: txHash,
              one_time_address: stealthAddress,
              ephemeral_public_key: ephemeralPublicKey,
              amount_sats: 0, // amount resolved separately via on-chain balance lookup
            };
            const { data: payment } = await supabase
              .from('detected_payments')
              .insert(paymentInsert as never)
              .select()
              .single();
            if (payment) detected.push(payment as DetectedPayment);
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
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const walletId = searchParams.get('walletId');

  const supabase = getSupabaseAdmin();

  // First get wallet ids belonging to user, then filter detected payments
  const walletsQuery = supabase.from('wallets').select('id').eq('user_id', authResult.userId);

  const { data: userWallets } = await walletsQuery;
  const walletIds = (userWallets ?? []).map((wallet: { id: string }) => wallet.id);

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
