import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateStealthAddress } from '@scopelift/stealth-address-sdk';
import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@stealth/db';

const prepareSchema = z.object({
  senderWalletId: z.string().trim().min(1, 'senderWalletId is required'),
  receiverStealthMetaAddressURI: z
    .string()
    .regex(/^st:[a-zA-Z0-9]+:0x[0-9a-fA-F]{132}$/, 'Invalid ERC-5564 stealth meta-address URI'),
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

  const { senderWalletId, receiverStealthMetaAddressURI, amountSats } = parsed.data;

  const admin = getSupabaseAdmin();

  // Verify wallet exists and belongs to the authenticated user.
  const { data: wallet, error: walletErr } = await admin
    .from('wallets')
    .select('id, wallet_id, user_id')
    .or(`id.eq.${senderWalletId},wallet_id.eq.${senderWalletId}`)
    .limit(1)
    .maybeSingle();

  if (walletErr || !wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Sender wallet not found.' } },
      { status: 404 }
    );
  }

  if ((wallet as { user_id?: string }).user_id !== auth.userId) {
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
    // Derive ERC-5564 one-time stealth address.
    const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress({
      stealthMetaAddressURI: receiverStealthMetaAddressURI,
    });

    return NextResponse.json(
      {
        data: {
          stealthAddress,
          ephemeralPublicKey,
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
