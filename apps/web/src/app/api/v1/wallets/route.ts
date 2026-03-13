import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@stealth/db';
import { generateStealthKeys } from '@stealth/crypto';
import { createBitGoWallet } from '@stealth/bitgo-client';
import { requireAuth } from '@/lib/auth';

const createWalletSchema = z.object({
  label: z.string().min(1).max(100),
  passphrase: z.string().min(8),
});

// GET /api/v1/wallets — list wallets for current user
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const supabase = getSupabaseAdmin();

  const { data: wallets, error } = await supabase
    .from('wallets')
    .select('id, label, bitgo_wallet_id, network, public_view_key, public_spend_key, created_at')
    .eq('user_id', authResult.userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: wallets, meta: { timestamp: new Date().toISOString() } });
}

// POST /api/v1/wallets — create wallet + stealth keys
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const body = await request.json();
  const parsed = createWalletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 }
    );
  }

  const { label, passphrase } = parsed.data;

  try {
    // 1. Generate stealth key pairs
    const stealthKeys = generateStealthKeys();

    // 2. Create BitGo wallet
    const { walletId: bitgoWalletId } = await createBitGoWallet(label, passphrase);

    // 3. Persist to Supabase (private keys — encrypt with KMS in prod!)
    const supabase = getSupabaseAdmin();
    const { data: wallet, error } = await supabase
      .from('wallets')
      .insert({
        user_id: authResult.userId,
        label,
        bitgo_wallet_id: bitgoWalletId,
        public_view_key: stealthKeys.viewKey.publicKey,
        public_spend_key: stealthKeys.spendKey.publicKey,
        encrypted_view_priv_key: stealthKeys.viewKey.privateKey, // TODO: encrypt
        encrypted_spend_priv_key: stealthKeys.spendKey.privateKey, // TODO: encrypt
      })
      .select()
      .single();

    if (error || !wallet) {
      throw new Error(error?.message ?? 'Insert failed');
    }

    return NextResponse.json(
      {
        data: {
          id: wallet.id,
          label: wallet.label,
          bitgoWalletId: wallet.bitgo_wallet_id,
          stealthAddress: {
            publicViewKey: wallet.public_view_key,
            publicSpendKey: wallet.public_spend_key,
          },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/v1/wallets]', err);
    return NextResponse.json(
      { error: { code: 'WALLET_CREATION_FAILED', message: 'Failed to create wallet.' } },
      { status: 500 }
    );
  }
}
