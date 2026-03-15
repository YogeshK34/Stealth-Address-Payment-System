import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateStealthKeys } from '@stealth/crypto';
import { getSupabaseAdmin } from '@stealth/db';
import { requireAuth } from '@/lib/auth';

// POST /api/v1/stealth/keygen-wallet
// Generate secp256k1 view + spend key pairs for a wallet and persist to Supabase.
// SECURITY NOTE: Private keys are stored unencrypted — encrypt before production use.
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

  const parsed = z
    .object({ walletId: z.string().trim().min(1, 'walletId is required') })
    .safeParse(body);

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

  // Verify wallet belongs to the authenticated user.
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

  try {
    // Generate fresh secp256k1 view + spend key pairs.
    const stealthKeys = generateStealthKeys();

    // Only persist public keys and the view private key.
    // The spend private key (b) is NEVER stored server-side — it is returned
    // to the client exactly once so it can be encrypted and held in the browser.
    await (admin as any)
      .from('wallets')
      .update({
        public_view_key: stealthKeys.stealthAddress.publicViewKey,
        public_spend_key: stealthKeys.stealthAddress.publicSpendKey,
        encrypted_view_priv_key: stealthKeys.viewKey.privateKey,
        encrypted_spend_priv_key: null, // deliberately never stored
      })
      .eq('id', (wallet as { id: string }).id);

    return NextResponse.json(
      {
        data: {
          publicViewKey: stealthKeys.stealthAddress.publicViewKey,
          publicSpendKey: stealthKeys.stealthAddress.publicSpendKey,
          // One-time disclosure: client must encrypt and store this locally.
          // It will not be returned again and is not persisted on the server.
          spendPrivKey: stealthKeys.spendKey.privateKey,
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/v1/stealth/keygen-wallet]', err);
    return NextResponse.json(
      { error: { code: 'KEYGEN_FAILED', message: 'Failed to generate stealth keys.' } },
      { status: 500 }
    );
  }
}

// GET /api/v1/stealth/keygen-wallet?walletId=X
// Return the public stealth keys for a wallet (if they exist).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const walletId = searchParams.get('walletId');

  if (!walletId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'walletId query parameter is required.' } },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  const { data: wallet } = await (admin as any)
    .from('wallets')
    .select('id, user_id, public_view_key, public_spend_key')
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

  const w = wallet as {
    id: string;
    public_view_key: string | null;
    public_spend_key: string | null;
  };

  return NextResponse.json({
    data: {
      hasKeys: w.public_view_key !== null && w.public_spend_key !== null,
      publicViewKey: w.public_view_key,
      publicSpendKey: w.public_spend_key,
    },
    meta: { timestamp: new Date().toISOString() },
  });
}
