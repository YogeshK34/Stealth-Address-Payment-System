import { bytesToHex, hexToBytes } from '@stealth/shared';
import type { ScanResult, StealthAddress } from '@stealth/shared';
import { hashPoint, pointAdd, scalarBaseMultHex, scalarMult } from './keygen';

/**
 * Receiver / Scanner: check whether a transaction output belongs to this wallet.
 *
 * Algorithm:
 *   S'  = H(a·R)        same as sender's H(r·A) due to ECDH symmetry
 *   P'  = S'·G + B
 *   if P' === outputAddress → match
 *
 * @param ephemeralPublicKeyHex  R from transaction
 * @param privateViewKeyHex      a (receiver private view key)
 * @param stealthAddress         (A, B)  — B is public spend key
 * @param outputAddress          the on-chain output address to test
 */
export function scanTransaction(
  ephemeralPublicKeyHex: string,
  privateViewKeyHex: string,
  stealthAddress: StealthAddress,
  outputAddress: string
): ScanResult {
  // a·R
  const aR = scalarMult(privateViewKeyHex, ephemeralPublicKeyHex);

  // S' = H(a·R)
  const S = hashPoint(hexToBytes(aR));
  const sharedSecret = bytesToHex(S);

  // S'·G
  const SG = scalarBaseMultHex(sharedSecret);

  // P' = S'·G + B
  const derivedAddress = pointAdd(SG, stealthAddress.publicSpendKey);

  const match = derivedAddress.toLowerCase() === outputAddress.toLowerCase();

  return match ? { match: true, oneTimeAddress: derivedAddress, sharedSecret } : { match: false };
}

/**
 * Receiver: derive the one-time public key and shared secret from an ephemeral public key R.
 *
 * Used when we already have the stored one-time Bitcoin address and want to check
 * whether a transaction belongs to us by converting the derived pubkey to a Bitcoin
 * address and comparing.
 *
 * Algorithm:
 *   aR = a·R        (ECDH — same as sender's r·A)
 *   S  = H(a·R)
 *   P  = S·G + B    (one-time public key)
 *
 * @param ephemeralPublicKeyHex  R from transaction
 * @param privateViewKeyHex      a (receiver private view key)
 * @param publicSpendKey         B (receiver public spend key)
 */
export function deriveStealthOutput(
  ephemeralPublicKeyHex: string,
  privateViewKeyHex: string,
  publicSpendKey: string
): { oneTimePubKey: string; sharedSecret: string } {
  const aR = scalarMult(privateViewKeyHex, ephemeralPublicKeyHex);
  const S = hashPoint(hexToBytes(aR));
  const sharedSecret = bytesToHex(S);
  const SG = scalarBaseMultHex(sharedSecret);
  const oneTimePubKey = pointAdd(SG, publicSpendKey);
  return { oneTimePubKey, sharedSecret };
}
