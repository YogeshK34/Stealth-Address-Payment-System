// this function is when user had found one-time address and he wants to spend the money, so our function will generate the private key

import { addScalars } from './keygen';

/**
 * Receiver: derive the private key for a detected one-time address.
 *
 * x = S + b   (mod curve order)
 *
 * @param sharedSecretHex  S = H(a·R)  — from scanTransaction
 * @param privateSpendKey  b            — receiver private spend key
 * @returns x — the private key for the one-time address P
 */
export function deriveSpendingKey(sharedSecretHex: string, privateSpendKey: string): string {
  return addScalars(sharedSecretHex, privateSpendKey);
}
