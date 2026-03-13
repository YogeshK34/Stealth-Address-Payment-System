import { NextRequest, NextResponse } from 'next/server';
import { generateStealthAddress } from '@scopelift/stealth-address-sdk';
import { z } from 'zod';

// st:<chain>:<0x-prefixed-meta-address>
const deriveSchema = z.object({
  stealthMetaAddressURI: z
    .string()
    .regex(/^st:[a-zA-Z0-9]+:0x[0-9a-fA-F]{132}$/, 'Invalid ERC-5564 stealth meta-address URI'),
});

// POST /api/stealth/address
// Derives an ERC-5564 one-time stealth address using the SDK.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = deriveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { stealthMetaAddressURI } = parsed.data;

    const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress({
      stealthMetaAddressURI,
    });

    return NextResponse.json(
      { data: { stealthAddress, ephemeralPublicKey, viewTag } },
      { status: 200 }
    );
  } catch (err) {
    console.error('[POST /api/stealth/address]', err);
    return NextResponse.json(
      {
        error: {
          code: 'DERIVE_STEALTH_ADDRESS_FAILED',
          message: 'Failed to derive stealth address.',
        },
      },
      { status: 500 }
    );
  }
}
