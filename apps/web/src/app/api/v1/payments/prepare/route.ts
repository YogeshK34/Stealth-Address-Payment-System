import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateEphemeralKeyPair, deriveOneTimeAddress } from '@stealth/crypto';
import { getSupabaseAdmin } from '@stealth/db';
import { requireAuth } from '@/lib/auth';
import { publicKeyToBtcAddress } from '@/lib/btc-address';

const COMPRESSED_KEY_REGEX = /^(02|03)[0-9a-fA-F]{64}$/;

const prepareSchema = z.object({
  senderWalletId: z.string().trim().min(1, 'senderWalletId is required'),
  receiverViewKey: z
    .string()
    .regex(COMPRESSED_KEY_REGEX, 'receiverViewKey must be a 33-byte compressed secp256k1 key'),
  receiverSpendKey: z
    .string()
    .regex(COMPRESSED_KEY_REGEX, 'receiverSpendKey must be a 33-byte compressed secp256k1 key'),
  amountSats: z.number().int().positive('amountSats must be a positive integer'),
});

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// POST /api/v1/payments/prepare
// Derive a one-time Bitcoin P2WPKH address from the receiver's stealth public keys
// using secp256k1 ECDH (same curve as EIP-5564, but outputs a proper Bitcoin address).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  const parsed = prepareSchema.safeParse(body);

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

  const { senderWalletId, receiverViewKey, receiverSpendKey, amountSats } = parsed.data;

  const admin = getSupabaseAdmin();

  // Verify sender wallet exists and belongs to the authenticated user.
  const { data: wallet } = await (admin as any)
    .from('wallets')
    .select('id, wallet_id, user_id')
    .or(`id.eq.${senderWalletId},wallet_id.eq.${senderWalletId}`)
    .limit(1)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Sender wallet not found.' } },
      { status: 404 }
    );
  }

  if ((wallet as { user_id: string }).user_id !== auth.userId) {
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
    // Generate a fresh ephemeral key pair: r, R = r·G
    const ephemeral = generateEphemeralKeyPair();

    // Derive one-time point: P = H(r·A)·G + B
    const { oneTimeAddress: oneTimePubKey, sharedSecret } = deriveOneTimeAddress(
      ephemeral.privateKey,
      {
        publicViewKey: receiverViewKey,
        publicSpendKey: receiverSpendKey,
      }
    );

    // Convert the one-time secp256k1 public key point → Bitcoin P2WPKH address (tb1q...)
    const btcAddress = publicKeyToBtcAddress(oneTimePubKey);

    // viewTag = first byte of the shared secret (enables fast scanning)
    const viewTag = sharedSecret.slice(0, 2);

    return NextResponse.json(
      {
        data: {
          stealthAddress: btcAddress,
          ephemeralPublicKey: ephemeral.publicKey, // 66-char hex, no 0x prefix
          viewTag,
          amountSats,
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[POST /api/v1/payments/prepare]', err);
    return NextResponse.json(
      { error: { code: 'PREPARE_PAYMENT_FAILED', message: 'Failed to prepare stealth payment.' } },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to prepare payments.' } },
    { status: 405 }
  );
}
