import { getSupabaseAdmin } from '@stealth/db';
import {
  createTbtcMpcWallet,
  createTbtcReceiveAddress,
  fetchTbtcWallet,
  isMpcWallet,
  type BitGoMpcWalletDetails,
} from '@/lib/bitgo-mpc';

export type WalletMetadata = {
  id: string;
  userId: string;
  walletId: string;
  coin: string;
  walletLabel: string;
  multisigType: string | null;
  walletType: string | null;
  receiveAddress: string | null;
  createdAt: string;
};

export type WalletSummary = {
  walletId: string;
  network: 'TBTC';
  walletType: string;
  multisigType: string;
  receiveAddress: string;
  balance: string;
  walletLabel: string;
  keys: string[];
  createdAt: string | null;
  isMpc: boolean;
  warning?: string;
};

type WalletMetadataRow = {
  id: string;
  user_id: string;
  wallet_id: string;
  coin: string;
  wallet_label: string;
  multisig_type: string | null;
  wallet_type: string | null;
  receive_address: string | null;
  created_at: string;
};

function toSummary(input: {
  details: BitGoMpcWalletDetails;
  receiveAddress: string;
  warning?: string;
}): WalletSummary {
  const { details, receiveAddress, warning } = input;

  return {
    walletId: details.walletId,
    network: 'TBTC',
    walletType: details.walletType || 'hot',
    multisigType: details.multisigType || 'unknown',
    receiveAddress,
    balance: details.balance || '0',
    walletLabel: details.walletLabel,
    keys: details.keys,
    createdAt: details.createdAt,
    isMpc: isMpcWallet(details),
    warning,
  };
}

export async function saveWalletMetadata(params: {
  userId: string;
  wallet: BitGoMpcWalletDetails;
  receiveAddress: string;
}): Promise<WalletMetadata> {
  const admin = getSupabaseAdmin();
  const walletType = params.wallet.walletType || 'hot';

  const payload = {
    user_id: params.userId,
    wallet_id: params.wallet.walletId,
    bitgo_wallet_id: params.wallet.walletId,
    coin: 'tbtc',
    network: 'tbtc',
    wallet_label: params.wallet.walletLabel || 'TBTC MPC Wallet',
    label: params.wallet.walletLabel || 'TBTC MPC Wallet',
    multisig_type: params.wallet.multisigType || null,
    wallet_type: walletType,
    receive_address: params.receiveAddress,
  };

  const { data, error } = await (admin as any)
    .from('wallets')
    .upsert(payload, { onConflict: 'wallet_id' })
    .select(
      'id, user_id, wallet_id, coin, wallet_label, multisig_type, wallet_type, receive_address, created_at'
    )
    .single();

  const row = data as WalletMetadataRow | null;

  if (error || !row) {
    throw new Error(`Failed to persist wallet metadata: ${error?.message ?? 'unknown error'}`);
  }

  return {
    id: row.id,
    userId: row.user_id,
    walletId: row.wallet_id,
    coin: row.coin,
    walletLabel: row.wallet_label,
    multisigType: row.multisig_type,
    walletType: row.wallet_type,
    receiveAddress: row.receive_address,
    createdAt: row.created_at,
  };
}

export async function createWalletForUser(params: {
  userId: string;
  label: string;
  passphrase: string;
}): Promise<{ metadata: WalletMetadata; summary: WalletSummary }> {
  const created = await createTbtcMpcWallet({ label: params.label, passphrase: params.passphrase });

  const metadata = await saveWalletMetadata({
    userId: params.userId,
    wallet: created.wallet,
    receiveAddress: created.receiveAddress,
  });

  return {
    metadata,
    summary: toSummary({ details: created.wallet, receiveAddress: created.receiveAddress }),
  };
}

export async function linkWalletForUser(params: {
  userId: string;
  walletId: string;
}): Promise<{ metadata: WalletMetadata; summary: WalletSummary }> {
  const details = await fetchTbtcWallet(params.walletId);

  if (!isMpcWallet(details)) {
    const warning =
      'This wallet was not created using BitGo MPC. Standard wallets store private keys in a single location. For better security we recommend creating a new MPC wallet.';

    return {
      metadata: {
        id: '',
        userId: params.userId,
        walletId: details.walletId,
        coin: details.coin,
        walletLabel: details.walletLabel,
        multisigType: details.multisigType,
        walletType: details.walletType,
        receiveAddress: null,
        createdAt: details.createdAt ?? new Date().toISOString(),
      },
      summary: toSummary({ details, receiveAddress: '', warning }),
    };
  }

  // Reuse the stored receive address if one already exists — avoid creating a new
  // BitGo address on every link call.
  const admin = getSupabaseAdmin();
  const { data: existing } = await (admin as any)
    .from('wallets')
    .select('receive_address')
    .eq('wallet_id', params.walletId)
    .maybeSingle();

  const receiveAddress: string =
    (existing as { receive_address?: string } | null)?.receive_address ||
    (await createTbtcReceiveAddress(params.walletId));

  const metadata = await saveWalletMetadata({
    userId: params.userId,
    wallet: details,
    receiveAddress,
  });

  return {
    metadata,
    summary: toSummary({ details, receiveAddress }),
  };
}

export async function getUserWalletMetadata(userId: string): Promise<WalletMetadata[]> {
  const admin = getSupabaseAdmin();

  const { data, error } = await (admin as any)
    .from('wallets')
    .select(
      'id, user_id, wallet_id, coin, wallet_label, multisig_type, wallet_type, receive_address, created_at'
    )
    .eq('user_id', userId)
    .eq('coin', 'tbtc')
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as WalletMetadataRow[];

  if (error) {
    throw new Error(`Failed to read wallet metadata: ${error.message}`);
  }

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    walletId: row.wallet_id,
    coin: row.coin,
    walletLabel: row.wallet_label,
    multisigType: row.multisig_type,
    walletType: row.wallet_type,
    receiveAddress: row.receive_address,
    createdAt: row.created_at,
  }));
}

export async function getUserWalletSummaries(userId: string): Promise<WalletSummary[]> {
  const metadataRows = await getUserWalletMetadata(userId);

  return Promise.all(
    metadataRows.map(async (row) => {
      try {
        const details = await fetchTbtcWallet(row.walletId);
        return toSummary({
          details,
          receiveAddress: row.receiveAddress ?? '',
        });
      } catch {
        return {
          walletId: row.walletId,
          network: 'TBTC',
          walletType: row.walletType || 'unknown',
          multisigType: row.multisigType || 'unknown',
          receiveAddress: row.receiveAddress || '',
          balance: '0',
          walletLabel: row.walletLabel,
          keys: [],
          createdAt: row.createdAt,
          isMpc: row.multisigType === 'tss' || row.multisigType === 'onchain',
        };
      }
    })
  );
}
