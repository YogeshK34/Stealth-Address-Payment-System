import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateEphemeralKeyPair, deriveOneTimeAddress } from '@stealth/crypto';
import { requireAuth } from '@/lib/auth';

const deriveSchema = z.object({
  publicViewKey: z.string().regex(/^(02|03)[0-9a-fA-F]{64}$/, 'Invalid compressed public key'),
  publicSpendKey: z.string().regex(/^(02|03)[0-9a-fA-F]{64}$/, 'Invalid compressed public key'),
});

// POST /api/v1/stealth/address — derive a one-time address from a stealth address
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const body = await request.json();
  const parsed = deriveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_STEALTH_ADDRESS', message: parsed.error.message } },
      { status: 400 }
    );
  }

  const ephemeral = generateEphemeralKeyPair();
  const derived = deriveOneTimeAddress(ephemeral.privateKey, parsed.data);

  // Never return the ephemeral private key
  return NextResponse.json({
    data: {
      oneTimeAddress: derived.oneTimeAddress,
      ephemeralPublicKey: derived.ephemeralPublicKey,
      // sharedSecret intentionally omitted
    },
    meta: { timestamp: new Date().toISOString() },
  });
}
