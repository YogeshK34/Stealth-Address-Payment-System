import { NextResponse } from 'next/server';
import { generateRandomStealthMetaAddress } from '@scopelift/stealth-address-sdk';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

// POST /api/stealth/keygen
// Generates an ERC-5564 compatible stealth keypair and meta-address URI.
export async function POST(): Promise<NextResponse> {
  try {
    const {
      viewingPrivateKey,
      viewingPublicKey,
      spendingPrivateKey,
      spendingPublicKey,
      stealthMetaAddressURI,
    } = generateRandomStealthMetaAddress();

    // Deterministic id: SHA-256 of the canonical meta-address URI.
    const id = bytesToHex(sha256(utf8ToBytes(stealthMetaAddressURI)));

    return NextResponse.json(
      {
        data: {
          id,
          stealthMetaAddressURI,
          scanPrivateKey: viewingPrivateKey,
          scanPublicKey: viewingPublicKey,
          spendPrivateKey: spendingPrivateKey,
          spendPublicKey: spendingPublicKey,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[POST /api/stealth/keygen]', err);
    return NextResponse.json(
      { error: { code: 'KEYGEN_FAILED', message: 'Failed to generate stealth keys.' } },
      { status: 500 }
    );
  }
}
