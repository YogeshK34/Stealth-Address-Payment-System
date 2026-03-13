import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getSupabaseAdmin,
  type Transaction,
  type TransactionInsert,
  type Wallet as DbWallet,
} from '@stealth/db';
import { generateEphemeralKeyPair, deriveOneTimeAddress } from '@stealth/crypto';
import { sendStealthTransaction } from '@stealth/bitgo-client';
import { requireAuth } from '@/lib/auth';

const sendSchema = z.object({
  senderWalletId: z.string().cuid(),
  receiverPublicViewKey: z.string().regex(/^(02|03)[0-9a-fA-F]{64}$/),
  receiverPublicSpendKey: z.string().regex(/^(02|03)[0-9a-fA-F]{64}$/),
  amountSats: z.number().int().positive().min(1000),
  walletPassphrase: z.string().min(1),
});

// POST /api/v1/transactions/send
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const body = await request.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 }
    );
  }

  const {
    senderWalletId,
    receiverPublicViewKey,
    receiverPublicSpendKey,
    amountSats,
    walletPassphrase,
  } = parsed.data;

  // Verify wallet belongs to user
  const supabase = getSupabaseAdmin();
  const { data: walletData } = await supabase
    .from('wallets')
    .select('id, bitgo_wallet_id, encrypted_view_priv_key, public_view_key, public_spend_key')
    .eq('id', senderWalletId)
    .eq('user_id', authResult.userId)
    .single();
  const wallet = walletData as Pick<
    DbWallet,
    'id' | 'bitgo_wallet_id' | 'encrypted_view_priv_key' | 'public_view_key' | 'public_spend_key'
  > | null;
  if (!wallet) {
    return NextResponse.json(
      { error: { code: 'WALLET_NOT_FOUND', message: 'Sender wallet not found.' } },
      { status: 404 }
    );
  }

  try {
    // 1. Derive one-time address
    const ephemeral = generateEphemeralKeyPair();
    const derived = deriveOneTimeAddress(ephemeral.privateKey, {
      publicViewKey: receiverPublicViewKey,
      publicSpendKey: receiverPublicSpendKey,
    });

    // 2. Broadcast via BitGo
    const result = await sendStealthTransaction({
      walletId: wallet.bitgo_wallet_id,
      walletPassphrase,
      recipientAddress: derived.oneTimeAddress,
      amountSats,
      ephemeralPublicKey: derived.ephemeralPublicKey,
    });

    // 3. Record in Supabase
    const txInsert: TransactionInsert = {
      wallet_id: wallet.id,
      tx_hash: result.txHash,
      direction: 'send',
      amount_sats: amountSats,
      ephemeral_public_key: derived.ephemeralPublicKey,
      one_time_address: derived.oneTimeAddress,
      status: 'pending',
    };

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert(txInsert as never)
      .select()
      .single();
    const tx = txData as Transaction | null;

    if (txError || !tx) {
      throw new Error(txError?.message ?? 'Failed to record transaction');
    }

    return NextResponse.json(
      {
        data: {
          txHash: tx.tx_hash,
          oneTimeAddress: tx.one_time_address,
          ephemeralPublicKey: tx.ephemeral_public_key,
          amountSats: tx.amount_sats,
          status: tx.status,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/v1/transactions/send]', err);
    return NextResponse.json(
      { error: { code: 'TX_BUILD_FAILED', message: 'Transaction failed.' } },
      { status: 500 }
    );
  }
}
