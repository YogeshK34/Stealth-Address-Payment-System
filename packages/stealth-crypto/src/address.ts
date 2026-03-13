import { bytesToHex, hexToBytes } from '@stealth/shared';
import type { DerivedOneTimeAddress, StealthAddress } from '@stealth/shared';
import * as secp from '@noble/secp256k1';
import { hashPoint, pointAdd, scalarBaseMultHex, scalarMult } from './keygen';

/**
 * Sender: derive a one-time address P from the receiver's stealth address.
 *
 * Algorithm:
 *   r  = random ephemeral private key (passed in)
 *   R  = r·G                                 (ephemeral public key)
 *   S  = H(r·A)                              (shared secret)
 *   P  = S·G + B                             (one-time address)
 *
 * @param ephemeralPrivKeyHex  r — fresh random 32-byte hex
 * @param stealthAddress       receiver's (A, B)
 */
export function deriveOneTimeAddress(
  ephemeralPrivKeyHex: string,
  stealthAddress: StealthAddress
): DerivedOneTimeAddress {
  const r = hexToBytes(ephemeralPrivKeyHex);
  const { publicViewKey, publicSpendKey } = stealthAddress;

  // R = r·G
  const R = secp.getPublicKey(r, true);
  const ephemeralPublicKey = bytesToHex(R);

  // r·A  (scalar × existing point)
  const rA = scalarMult(ephemeralPrivKeyHex, publicViewKey);

  // S = H(r·A)
  const S = hashPoint(hexToBytes(rA));
  const sharedSecret = bytesToHex(S);

  // S·G
  const SG = scalarBaseMultHex(sharedSecret);

  // P = S·G + B
  const oneTimeAddress = pointAdd(SG, publicSpendKey);

  return { oneTimeAddress, ephemeralPublicKey, sharedSecret };
}
