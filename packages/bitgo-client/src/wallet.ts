import type { WalletBalance } from '@stealth/shared';
import { getBitGoInstance } from './client';

const COIN = process.env['BITGO_COIN'] ?? 'tbtc';

/**
 * Create a new BitGo wallet for a user.
 */
export async function createBitGoWallet(
  label: string,
  passphrase: string
): Promise<{ walletId: string; address: string }> {
  const bitgo = await getBitGoInstance();
  const coin = bitgo.coin(COIN);
  const enterpriseId = process.env['BITGO_ENTERPRISE_ID'];

  const result = await coin.wallets().generateWallet({
    label,
    passphrase,
    enterprise: enterpriseId,
    passcodeEncryptionCode: passphrase,
  });

  const receiveAddress = result.wallet.receiveAddress() as
    | string
    | { address?: string }
    | undefined;

  return {
    walletId: result.wallet.id(),
    address: typeof receiveAddress === 'string' ? receiveAddress : (receiveAddress?.address ?? ''),
  };
}

/**
 * Fetch an existing BitGo wallet by ID.
 */
export async function getBitGoWallet(walletId: string): Promise<unknown> {
  const bitgo = await getBitGoInstance();
  return bitgo.coin(COIN).wallets().get({ id: walletId });
}

/**
 * Get the confirmed + unconfirmed balance for a wallet.
 */
export async function getWalletBalance(walletId: string): Promise<WalletBalance> {
  const bitgo = await getBitGoInstance();
  const wallet = await bitgo.coin(COIN).wallets().get({ id: walletId });
  const bal = wallet as unknown as {
    spendableBalance: number;
    balanceString: string;
    unconfirmedReceives: number;
  };

  return {
    walletId,
    confirmed: typeof bal.spendableBalance === 'number' ? bal.spendableBalance : 0,
    unconfirmed: typeof bal.unconfirmedReceives === 'number' ? bal.unconfirmedReceives : 0,
    spendable: typeof bal.spendableBalance === 'number' ? bal.spendableBalance : 0,
  };
}

/**
 * List all wallets for the enterprise.
 */
export async function listWallets(): Promise<unknown[]> {
  const bitgo = await getBitGoInstance();
  const result = await bitgo.coin(COIN).wallets().list({});
  return (result as { wallets: unknown[] }).wallets ?? [];
}
