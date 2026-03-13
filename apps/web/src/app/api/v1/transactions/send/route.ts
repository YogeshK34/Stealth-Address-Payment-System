import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getSupabaseAdmin,
  type Transaction,
  type TransactionInsert,
  type Wallet as DbWallet,
} from '@stealth/db';
import { generateStealthAddress, VALID_SCHEME_ID } from '@scopelift/stealth-address-sdk';
import { stealthClient } from '@/lib/stealthClient';
import { sendStealthTransaction } from '@stealth/bitgo-client';
import { requireAuth } from '@/lib/auth';

// ERC5564Announcer contract address (Sepolia / mainnet address from the ERC-5564 spec).
// Override via env var for other networks.
const ERC5564_ADDRESS =
  (process.env.ERC5564_ANNOUNCER_ADDRESS as `0x${string}`) ??
  '0x55649E01B5Df198D18D95b5cc5051630cfD45564';

const sendSchema = z.object({
  senderWalletId: z.string().cuid(),
  // ERC-5564 meta-address URI: st:<chain>:0x<132-hex>
  receiverStealthMetaAddressURI: z
    .string()
    .regex(/^st:[a-zA-Z0-9]+:0x[0-9a-fA-F]{132}$/, 'Invalid ERC-5564 stealth meta-address URI'),
  amountSats: z.number().int().positive().min(1000),
  walletPassphrase: z.string().min(1),
  // Ethereum sender address for the ERC-5564 announcement (optional – skipped if absent).
  senderAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
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
    receiverStealthMetaAddressURI,
    amountSats,
    walletPassphrase,
    senderAddress,
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
    // 1. Derive ERC-5564 one-time stealth address via SDK.
    const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress({
      stealthMetaAddressURI: receiverStealthMetaAddressURI,
    });

    // 2. Prepare ERC-5564 announcement payload (non-blocking; failure doesn't abort send).
    let announcePayload: Awaited<ReturnType<typeof stealthClient.prepareAnnounce>> | null = null;
    if (senderAddress) {
      try {
        // metadata = viewTag byte prefixed with 0x01 (ERC-5564 scheme 1 convention).
        const metadata = `0x01${viewTag.replace(/^0x/, '')}` as `0x${string}`;
        announcePayload = await stealthClient.prepareAnnounce({
          account: senderAddress as `0x${string}`,
          ERC5564Address: ERC5564_ADDRESS,
          args: {
            schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
            stealthAddress,
            ephemeralPublicKey,
            metadata,
          },
        });
      } catch (announceErr) {
        console.warn('[prepareAnnounce] Could not prepare announce payload:', announceErr);
      }
    }

    // 3. Broadcast via BitGo (Bitcoin layer).
    const result = await sendStealthTransaction({
      walletId: wallet.bitgo_wallet_id,
      walletPassphrase,
      recipientAddress: stealthAddress,
      amountSats,
      ephemeralPublicKey,
    });

    // 4. Record in Supabase.
    const txInsert: TransactionInsert = {
      wallet_id: wallet.id,
      tx_hash: result.txHash,
      direction: 'send',
      amount_sats: amountSats,
      ephemeral_public_key: ephemeralPublicKey,
      one_time_address: stealthAddress,
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
          stealthAddress: tx.one_time_address,
          ephemeralPublicKey: tx.ephemeral_public_key,
          viewTag,
          amountSats: tx.amount_sats,
          status: tx.status,
          ...(announcePayload ? { announcePayload } : {}),
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
