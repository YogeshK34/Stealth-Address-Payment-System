import { getBitGoInstance } from './client';

const COIN = process.env['BITGO_COIN'] ?? 'tbtc';

export interface BuildTxOptions {
  walletId: string;
  walletPassphrase: string;
  recipientAddress: string; // the one-time address P
  amountSats: number;
  /** Hex-encoded ephemeral public key R — embedded in OP_RETURN comment */
  ephemeralPublicKey: string;
  comment?: string;
}

export interface BroadcastResult {
  txHash: string;
  status: string;
}

/**
 * Build, sign, and broadcast a stealth payment transaction via BitGo.
 * The ephemeral public key is passed as a comment/label so it can be
 * retrieved by the scanner.
 */
export async function sendStealthTransaction(opts: BuildTxOptions): Promise<BroadcastResult> {
  const bitgo = getBitGoInstance();
  const wallet = await bitgo.coin(COIN).wallets().get({ id: opts.walletId });

  const result = await (
    wallet as unknown as {
      sendMany: (opts: unknown) => Promise<{ txid: string; status: string }>;
    }
  ).sendMany({
    recipients: [
      {
        address: opts.recipientAddress,
        amount: String(opts.amountSats),
      },
    ],
    walletPassphrase: opts.walletPassphrase,
    comment: `stealth:ephemeral:${opts.ephemeralPublicKey}`,
    label: opts.ephemeralPublicKey,
  });

  return { txHash: result.txid, status: result.status };
}

/**
 * Fetch recent transfers for a wallet (used by scanner).
 */
export async function getWalletTransfers(walletId: string, limit = 25): Promise<unknown[]> {
  const bitgo = getBitGoInstance();
  const wallet = await bitgo.coin(COIN).wallets().get({ id: walletId });
  const result = await (
    wallet as unknown as {
      transfers: (opts: unknown) => Promise<{ transfers: unknown[] }>;
    }
  ).transfers({ limit });
  return result.transfers ?? [];
}
