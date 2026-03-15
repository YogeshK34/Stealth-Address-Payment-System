/**
 * Minimal TinySecp256k1Interface adapter for bitcoinjs-lib v7 using @noble/secp256k1.
 *
 * bitcoinjs-lib v7 only requires two methods (both Taproot-related).
 * We implement them so initEccLib() succeeds even though our sweep
 * transactions use P2WPKH (not Taproot).
 */

import * as secp from '@noble/secp256k1';

function xOnlyToFull(xOnly: Uint8Array): Uint8Array {
  // Assume even-y (0x02 prefix) for x-only points.
  const full = new Uint8Array(33);
  full[0] = 0x02;
  full.set(xOnly, 1);
  return full;
}

export const nobleEcc = {
  isXOnlyPoint(p: Uint8Array): boolean {
    if (p.length !== 32) return false;
    try {
      secp.ProjectivePoint.fromHex(xOnlyToFull(p));
      return true;
    } catch {
      return false;
    }
  },

  xOnlyPointAddTweak(
    p: Uint8Array,
    tweak: Uint8Array
  ): { parity: 0 | 1; xOnlyPubkey: Uint8Array } | null {
    try {
      const point = secp.ProjectivePoint.fromHex(xOnlyToFull(p));
      const tweakScalar = BigInt('0x' + Buffer.from(tweak).toString('hex'));
      const result = point.add(secp.ProjectivePoint.BASE.multiply(tweakScalar));
      const raw = result.toRawBytes(true); // compressed, 33 bytes
      const parity = (raw[0] === 0x02 ? 0 : 1) as 0 | 1;
      return { parity, xOnlyPubkey: raw.slice(1) };
    } catch {
      return null;
    }
  },
};
