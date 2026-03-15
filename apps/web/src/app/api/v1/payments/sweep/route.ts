import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as bitcoin from 'bitcoinjs-lib';
import * as secp from '@noble/secp256k1';
import { deriveStealthOutput, deriveSpendingKey } from '@stealth/crypto';
import { getSupabaseAdmin } from '@stealth/db';
import { requireAuth } from '@/lib/auth';
import { publicKeyToBtcAddress } from '@/lib/btc-address';

const sweepSchema = z.object({
  walletId: z.string().trim().min(1, 'walletId is required'),
  // The tx record ID from the scan result
  txHash: z.string().trim().min(1, 'txHash is required'),
  // The one-time address that received funds (tb1q...)
  oneTimeAddress: z.string().min(14, 'Invalid oneTimeAddress'),
  // Shared secret from scan result (hex, 64 chars)
  sharedSecret: z.string().regex(/^[0-9a-fA-F]{64}$/, 'sharedSecret must be 64 hex chars'),
  // Where to sweep funds to — defaults to wallet's receive_address if omitted
  destinationAddress: z.string().min(14).optional(),
  // Sat/vbyte fee rate — default 5 for testnet
  feeRate: z.number().int().min(1).max(1000).optional(),
});

const BLOCKSTREAM_TESTNET = 'https://blockstream.info/testnet/api';
const BLOCKSTREAM_MAINNET = 'https://blockstream.info/api';

function blockstreamBase(): string {
  return process.env.BITGO_COIN === 'btc' ? BLOCKSTREAM_MAINNET : BLOCKSTREAM_TESTNET;
}

interface UtxoEntry {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean };
}

async function fetchUtxos(address: string): Promise<UtxoEntry[]> {
  const res = await fetch(`${blockstreamBase()}/address/${address}/utxo`);
  if (!res.ok) throw new Error(`UTXO fetch failed: ${res.statusText}`);
  return res.json() as Promise<UtxoEntry[]>;
}

async function broadcastTx(rawHex: string): Promise<string> {
  const res = await fetch(`${blockstreamBase()}/tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: rawHex,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Broadcast failed: ${text}`);
  }
  return res.text(); // returns txid
}

// POST /api/v1/payments/sweep
// Build and broadcast a transaction that sweeps funds from a one-time stealth address
// to the user's regular wallet receive address.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be JSON.' } },
      { status: 400 }
    );
  }

  const parsed = sweepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid request.',
        },
      },
      { status: 400 }
    );
  }

  const { walletId, txHash, oneTimeAddress, sharedSecret, feeRate = 5 } = parsed.data;
  let { destinationAddress } = parsed.data;

  const admin = getSupabaseAdmin();

  // Fetch wallet — need private spend key and receive_address.
  const { data: wallet } = await (admin as any)
    .from('wallets')
    .select(
      'id, user_id, wallet_id, encrypted_spend_priv_key, encrypted_view_priv_key, public_spend_key, receive_address'
    )
    .or(`id.eq.${walletId},wallet_id.eq.${walletId}`)
    .limit(1)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found.' } },
      { status: 404 }
    );
  }

  const w = wallet as {
    id: string;
    user_id: string;
    wallet_id: string;
    encrypted_spend_priv_key: string | null;
    encrypted_view_priv_key: string | null;
    public_spend_key: string | null;
    receive_address: string | null;
  };

  if (w.user_id !== auth.userId) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Wallet does not belong to this user.' } },
      { status: 403 }
    );
  }

  if (!w.encrypted_spend_priv_key) {
    return NextResponse.json(
      {
        error: {
          code: 'NO_STEALTH_KEYS',
          message: 'This wallet has no stealth spend key. Generate stealth keys first.',
        },
      },
      { status: 400 }
    );
  }

  // Use wallet receive address as default sweep destination.
  if (!destinationAddress) {
    if (!w.receive_address) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_DESTINATION',
            message: 'No destinationAddress provided and wallet has no receive_address.',
          },
        },
        { status: 400 }
      );
    }
    destinationAddress = w.receive_address;
  }

  try {
    // Derive the spending private key: x = S + b (mod n)
    const spendingPrivKey = deriveSpendingKey(sharedSecret, w.encrypted_spend_priv_key);
    const privKeyBytes = Buffer.from(spendingPrivKey, 'hex');
    const pubKeyBytes = Buffer.from(secp.getPublicKey(privKeyBytes, true));

    const network =
      process.env.BITGO_COIN === 'btc' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

    // Confirm the derived public key produces the expected one-time address.
    const derivedAddress = publicKeyToBtcAddress(Buffer.from(pubKeyBytes).toString('hex'));
    if (derivedAddress.toLowerCase() !== oneTimeAddress.toLowerCase()) {
      return NextResponse.json(
        {
          error: {
            code: 'KEY_MISMATCH',
            message:
              'Derived spending key does not match the one-time address. Wrong sharedSecret?',
          },
        },
        { status: 400 }
      );
    }

    // Fetch UTXOs at the one-time address.
    const utxos = await fetchUtxos(oneTimeAddress);
    if (utxos.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_UTXOS',
            message:
              'No funds found at this stealth address. The transaction may still be unconfirmed.',
          },
        },
        { status: 400 }
      );
    }

    // Build the P2WPKH locking script for the stealth address.
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubKeyBytes, network });
    if (!p2wpkh.output) throw new Error('Failed to build P2WPKH output script');

    // Build PSBT.
    const psbt = new bitcoin.Psbt({ network });
    let totalSats = 0;

    for (const utxo of utxos) {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: p2wpkh.output,
          value: BigInt(utxo.value),
        },
      });
      totalSats += utxo.value;
    }

    // Fee estimation: P2WPKH input ~68 vbytes, P2WPKH output 31 vbytes, overhead 11.
    const vbytes = 11 + utxos.length * 68 + 31;
    const fee = vbytes * feeRate;
    const outputSats = totalSats - fee;

    const DUST_THRESHOLD = 546;
    if (outputSats <= DUST_THRESHOLD) {
      return NextResponse.json(
        {
          error: {
            code: 'DUST_OUTPUT',
            message: `Output value ${outputSats} sats is below dust threshold after fee of ${fee} sats.`,
          },
        },
        { status: 400 }
      );
    }

    psbt.addOutput({ address: destinationAddress, value: BigInt(outputSats) });

    // Sign all inputs using @noble/secp256k1 (already installed).
    const signer: bitcoin.Signer = {
      publicKey: pubKeyBytes,
      sign(hash: Uint8Array): Uint8Array {
        const sig = secp.sign(hash, new Uint8Array(privKeyBytes), { lowS: true });
        return sig.toCompactRawBytes();
      },
    };

    psbt.signAllInputs(signer);
    psbt.finalizeAllInputs();

    const rawTx = psbt.extractTransaction().toHex();

    // Broadcast the transaction.
    const sweepTxHash = await broadcastTx(rawTx);

    // Record the sweep in the transactions table.
    await (admin as any).from('transactions').insert({
      wallet_id: w.id,
      tx_hash: sweepTxHash,
      direction: 'receive',
      amount_sats: outputSats,
      one_time_address: oneTimeAddress,
      status: 'pending',
    });

    // Mark the original send transaction as swept.
    await (admin as any).from('transactions').update({ status: 'swept' }).eq('tx_hash', txHash);

    return NextResponse.json(
      {
        data: {
          sweepTxHash,
          fromAddress: oneTimeAddress,
          toAddress: destinationAddress,
          amountSats: outputSats,
          feeSats: fee,
          status: 'pending',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/v1/payments/sweep]', err);
    const message = err instanceof Error ? err.message : 'Sweep failed.';
    return NextResponse.json({ error: { code: 'SWEEP_FAILED', message } }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to sweep payments.' } },
    { status: 405 }
  );
}
