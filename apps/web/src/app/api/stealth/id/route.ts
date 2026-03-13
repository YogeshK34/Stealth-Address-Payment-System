import { NextRequest, NextResponse } from 'next/server';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { z } from 'zod';

// Accepts the ERC-5564 URI format: st:<chain>:0x<132-hex-meta-address>
const requestSchema = z.object({
  stealthMetaAddressURI: z
    .string()
    .regex(
      /^st:[a-zA-Z0-9]+:0x[0-9a-fA-F]{132}$/,
      'Invalid ERC-5564 stealth meta-address URI. Expected format: st:<chain>:0x<132-hex>'
    ),
});

// POST /api/stealth/id
// Returns a deterministic SHA-256 id for any valid stealth meta-address URI.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { stealthMetaAddressURI } = parsed.data;
    const id = bytesToHex(sha256(utf8ToBytes(stealthMetaAddressURI)));

    return NextResponse.json({ data: { id, stealthMetaAddressURI } }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/stealth/id]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to derive deterministic ID.' } },
      { status: 500 }
    );
  }
}
