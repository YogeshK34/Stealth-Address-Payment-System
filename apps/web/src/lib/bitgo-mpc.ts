import { getBitGoCoin } from '@/lib/bitgo';

export type BitGoMpcWalletDetails = {
  walletId: string;
  walletLabel: string;
  coin: string;
  walletType: string;
  multisigType: string;
  keys: string[];
  balance: string;
  createdAt: string | null;
};

export type BitGoMpcCreateResult = {
  wallet: BitGoMpcWalletDetails;
  receiveAddress: string;
};

type BitGoWalletShape = {
  id?: () => string;
  label?: () => string;
  coin?: () => string;
  type?: () => string;
  multisigType?: string | (() => string);
  balanceString?: string | (() => string);
  createdAt?: string;
  _wallet?: {
    id?: string;
    label?: string;
    coin?: string;
    type?: string;
    multisigType?: string;
    keys?: string[];
    balanceString?: string;
    createdAt?: string;
    createdDate?: string;
    receiveAddress?: { address?: string };
  };
};

function asString(input: unknown, fallback = ''): string {
  return typeof input === 'string' ? input : fallback;
}

function readWalletDetails(wallet: BitGoWalletShape): BitGoMpcWalletDetails {
  const raw = wallet._wallet ?? {};
  const balanceValue =
    typeof wallet.balanceString === 'function' ? wallet.balanceString() : wallet.balanceString;

  // multisigType can live in _wallet.multisigType (raw API response),
  // as a method wallet.multisigType(), or at the wallet top-level
  const multisigType =
    asString(raw.multisigType) ||
    (typeof wallet.multisigType === 'function'
      ? asString(wallet.multisigType())
      : asString(wallet.multisigType));

  return {
    walletId: asString(wallet.id?.(), asString(raw.id)),
    walletLabel: asString(wallet.label?.(), asString(raw.label)),
    coin: asString(wallet.coin?.(), asString(raw.coin, 'tbtc')),
    walletType: asString(wallet.type?.(), asString(raw.type, 'hot')),
    multisigType,
    keys: Array.isArray(raw.keys) ? raw.keys.map((k) => String(k)) : [],
    balance: asString(balanceValue, asString(raw.balanceString, '0')),
    createdAt: asString(raw.createdAt, asString(raw.createdDate || wallet.createdAt)) || null,
  };
}

export async function fetchTbtcWallet(walletId: string): Promise<BitGoMpcWalletDetails> {
  const coin = await getBitGoCoin('tbtc');
  const wallet = (await coin.wallets().get({ id: walletId })) as unknown as BitGoWalletShape;
  return readWalletDetails(wallet);
}

export async function fetchTbtcWalletWithAddress(
  walletId: string
): Promise<{ details: BitGoMpcWalletDetails; receiveAddress: string }> {
  const coin = await getBitGoCoin('tbtc');
  const walletResponse = (await coin
    .wallets()
    .get({ id: walletId })) as unknown as BitGoWalletShape;
  const details = readWalletDetails(walletResponse);

  // Extract the receive address directly from BitGo's response
  const receiveAddress = asString(walletResponse._wallet?.receiveAddress?.address);

  if (!receiveAddress) {
    throw new Error('BitGo wallet does not have a receive address.');
  }

  return { details, receiveAddress };
}

export async function createTbtcMpcWallet(params: {
  label: string;
  passphrase: string;
}): Promise<BitGoMpcCreateResult> {
  const coin = await getBitGoCoin('tbtc');

  const generated = await coin.wallets().generateWallet({
    label: params.label,
    passphrase: params.passphrase,
    enterprise: process.env.BITGO_ENTERPRISE_ID,
    passcodeEncryptionCode: params.passphrase,
    multisigType: 'tss',
  });

  const walletRef = generated.wallet as unknown as BitGoWalletShape;
  const walletId = asString(walletRef.id?.());

  if (!walletId) {
    throw new Error('BitGo wallet creation did not return a wallet id.');
  }

  const wallet = await fetchTbtcWallet(walletId);

  // Use the receiveAddress already embedded in the wallet response when available,
  // so we avoid a redundant createAddress API call on every wallet creation.
  const builtInAddress = walletRef._wallet?.receiveAddress?.address;
  const receiveAddress = builtInAddress || (await createTbtcReceiveAddress(walletId));

  return {
    wallet,
    receiveAddress,
  };
}

export async function createTbtcReceiveAddress(walletId: string): Promise<string> {
  const coin = await getBitGoCoin('tbtc');
  const wallet = (await coin.wallets().get({ id: walletId })) as {
    createAddress: (options?: Record<string, unknown>) => Promise<{ address?: string }>;
  };

  const created = await wallet.createAddress({ chain: 0 });
  const address = asString(created?.address);

  if (!address) {
    throw new Error('BitGo did not return a receiving address.');
  }

  return address;
}

// BitGo's standard 3-key onchain wallet (user key + backup key + BitGo key, 2-of-3)
// is multi-party custody just like TSS. TBTC on the test tier doesn't support TSS,
// so we accept both types as MPC-style wallets.
export function isMpcWallet(details: BitGoMpcWalletDetails): boolean {
  return details.multisigType === 'tss' || details.multisigType === 'onchain';
}
