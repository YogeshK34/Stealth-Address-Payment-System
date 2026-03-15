import * as bitcoin from 'bitcoinjs-lib';

/**
 * Convert a 33-byte compressed secp256k1 public key to a Bitcoin P2WPKH address.
 *
 * - On testnet (TBTC): returns a bech32 address with hrp "tb"  → tb1q…
 * - On mainnet (BTC):  returns a bech32 address with hrp "bc"  → bc1q…
 *
 * This is used to derive the one-time Bitcoin address from the stealth public-key point
 * P = H(r·A)·G + B after secp256k1 ECDH.
 *
 * NOTE: encryption of stored private keys is a TODO for production.
 */
export function publicKeyToBtcAddress(compressedPubKeyHex: string): string {
  const network =
    process.env.BITGO_COIN === 'btc' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

  const pubkey = Buffer.from(compressedPubKeyHex, 'hex');

  const { address } = bitcoin.payments.p2wpkh({ pubkey, network });
  if (!address) throw new Error('Failed to derive P2WPKH address from public key');

  return address;
}
