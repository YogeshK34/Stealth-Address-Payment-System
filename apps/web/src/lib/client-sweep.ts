'use client';

/**
 * Client-side sweep transaction builder.
 *
 * Runs entirely in the browser — the spend private key never leaves the client.
 * Uses bitcoinjs-lib (PSBT) + @noble/secp256k1 for signing.
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as secp from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { deriveSpendingKey } from '@stealth/crypto';
import { publicKeyToBtcAddress } from '@/lib/btc-address';
import { nobleEcc } from '@/lib/noble-ecc';

// Initialise bitcoinjs-lib's ECC backend once using our @noble/secp256k1 adapter.
// Without this, Psbt.signAllInputs and finalizeAllInputs throw
// "No ECC Library provided".
bitcoin.initEccLib(nobleEcc);

// @noble/secp256k1 v2 ships with hmacSha256Sync = undefined.
// The synchronous secp.sign() path (used by bitcoinjs-lib PSBT) calls
// hmacDrbg(false), which calls callHash('hmacSha256Sync').
// Without this setup it throws "hashes.hmacSha256Sync not set", which gets
// silently swallowed by Psbt.signAllInputs → "No inputs were signed".
secp.etc.hmacSha256Sync = (k: Uint8Array, ...msgs: Uint8Array[]) =>
  hmac(sha256, k, secp.etc.concatBytes(...msgs));

const ENDPOINTS = {
  mainnet: ['https://blockstream.info/api', 'https://mempool.space/api'],
  testnet: ['https://blockstream.info/testnet/api', 'https://mempool.space/testnet/api'],
};

function apiEndpoints(): string[] {
  return process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'mainnet'
    ? ENDPOINTS.mainnet
    : ENDPOINTS.testnet;
}

interface Utxo {
  txid: string;
  vout: number;
  value: number;
}

async function fetchUtxos(address: string): Promise<Utxo[]> {
  const endpoints = apiEndpoints();
  let lastErr = '';
  for (const base of endpoints) {
    try {
      const res = await fetch(`${base}/address/${address}/utxo`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return res.json() as Promise<Utxo[]>;
      const body = await res.text().catch(() => '');
      lastErr = `${base} → HTTP ${res.status}: ${body || '(no body)'}`;
      console.warn('[fetchUtxos]', lastErr);
    } catch (e) {
      lastErr = `${base} → ${e instanceof Error ? e.message : String(e)}`;
      console.warn('[fetchUtxos]', lastErr);
    }
  }
  throw new Error(`Failed to fetch UTXOs (tried ${endpoints.length} endpoints): ${lastErr}`);
}

export interface ClientSweepParams {
  sharedSecret: string; // S — from scan result
  spendPrivKey: string; // b — decrypted from localStorage
  oneTimeAddress: string; // tb1q... — the stealth address that received funds
  destinationAddress: string; // where to sweep to
  feeRate?: number; // sat/vbyte (default 5)
}

export interface ClientSweepResult {
  rawTxHex: string;
  sweepAmountSats: number;
  feeSats: number;
}

export async function buildAndSignSweepTx(params: ClientSweepParams): Promise<ClientSweepResult> {
  const { sharedSecret, spendPrivKey, oneTimeAddress, destinationAddress, feeRate = 5 } = params;

  // 1. Derive spending private key: x = S + b (mod n)
  const spendingPrivKey = deriveSpendingKey(sharedSecret, spendPrivKey);
  const privKeyBytes = Buffer.from(spendingPrivKey, 'hex');
  const pubKeyBytes = Buffer.from(secp.getPublicKey(privKeyBytes, true));

  // 2. Verify the derived key matches the expected one-time address.
  const derivedAddress = publicKeyToBtcAddress(Buffer.from(pubKeyBytes).toString('hex'));
  if (derivedAddress.toLowerCase() !== oneTimeAddress.toLowerCase()) {
    throw new Error(
      'Derived key does not match the one-time address — wrong spend key or shared secret.'
    );
  }

  const network =
    process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'mainnet'
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;

  // 3. Build P2WPKH payment (locking script for the stealth address inputs).
  const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubKeyBytes, network });
  if (!p2wpkh.output) throw new Error('Failed to derive P2WPKH output script');

  // 4. Fetch UTXOs at the one-time address.
  const utxos = await fetchUtxos(oneTimeAddress);
  if (utxos.length === 0) {
    throw new Error(
      'No UTXOs found at this stealth address. The transaction may not be confirmed yet.'
    );
  }

  // 5. Build PSBT.
  const psbt = new bitcoin.Psbt({ network });
  let totalSats = 0;
  for (const utxo of utxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: { script: p2wpkh.output, value: BigInt(utxo.value) },
    });
    totalSats += utxo.value;
  }

  // 6. Fee estimation: P2WPKH input ~68 vbytes, output 31, header 11.
  const vbytes = 11 + utxos.length * 68 + 31;
  const feeSats = vbytes * feeRate;
  const sweepAmountSats = totalSats - feeSats;

  const DUST_THRESHOLD = 546;
  if (sweepAmountSats <= DUST_THRESHOLD) {
    throw new Error(
      `Output (${sweepAmountSats} sats) is below dust threshold after fee (${feeSats} sats).`
    );
  }

  psbt.addOutput({ address: destinationAddress, value: BigInt(sweepAmountSats) });

  // 7. Sign all inputs.
  const signer: bitcoin.Signer = {
    publicKey: pubKeyBytes,
    sign(hash: Uint8Array): Uint8Array {
      const sig = secp.sign(hash, new Uint8Array(privKeyBytes), { lowS: true });
      return sig.toCompactRawBytes();
    },
  };

  psbt.signAllInputs(signer);
  psbt.finalizeAllInputs();

  const rawTxHex = psbt.extractTransaction().toHex();
  return { rawTxHex, sweepAmountSats, feeSats };
}
