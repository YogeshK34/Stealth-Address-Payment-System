/**
 * Bitcoin-native stealth meta-address format, inspired by ERC-5564.
 *
 *   st:<chain>:0x<viewPubKey_66hex><spendPubKey_66hex>
 *
 * 66 hex chars each (33 bytes, compressed secp256k1) → 132 hex total.
 * Examples:
 *   Testnet: st:btctest:0x02abc...def03abc...def
 *   Mainnet: st:btc:0x02abc...def03abc...def
 *
 * This encodes both public keys in a single opaque string that:
 *  - reveals neither private key
 *  - is distinct from any on-chain address
 *  - lets any sender derive a fresh one-time P2WPKH address via secp256k1 ECDH
 */

const META_ADDRESS_REGEX = /^st:[a-zA-Z0-9]+:0x([0-9a-fA-F]{132})$/;

/**
 * Encode a view + spend public-key pair into a stealth meta-address string.
 * Both keys must be 33-byte compressed secp256k1 public keys (66 hex chars, 02/03 prefix).
 */
export function formatStealthMetaAddress(
  viewPubKey: string,
  spendPubKey: string,
  chain: string = 'btctest'
): string {
  if (viewPubKey.length !== 66 || spendPubKey.length !== 66) {
    throw new Error('Each public key must be exactly 66 hex chars (33-byte compressed secp256k1)');
  }
  return `st:${chain}:0x${viewPubKey}${spendPubKey}`;
}

/**
 * Decode a stealth meta-address string back into view + spend public keys.
 * Returns null if the input does not match the expected format.
 */
export function parseStealthMetaAddress(
  input: string
): { viewKey: string; spendKey: string } | null {
  const match = input.trim().match(META_ADDRESS_REGEX);
  if (!match || !match[1]) return null;
  const hex = match[1]; // 132 hex chars
  return {
    viewKey: hex.slice(0, 66), // public view key (33 bytes)
    spendKey: hex.slice(66), // public spend key (33 bytes)
  };
}

/**
 * Returns true if the string looks like a valid stealth meta-address.
 */
export function isStealthMetaAddress(input: string): boolean {
  return META_ADDRESS_REGEX.test(input.trim());
}
