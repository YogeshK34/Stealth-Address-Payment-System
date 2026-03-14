'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';

type WalletSummary = {
  walletId: string;
  network: 'TBTC';
  walletType: string;
  multisigType: string;
  receiveAddress: string;
  balance: string;
  walletLabel: string;
  isMpc: boolean;
  warning?: string;
};

type WalletMetadata = {
  id: string;
  walletId: string;
  coin: string;
  walletLabel: string;
  multisigType: string | null;
  walletType: string | null;
  receiveAddress: string | null;
  createdAt: string;
};

type WalletListResponse = { data: { metadata: WalletMetadata[]; wallets: WalletSummary[] } };
type CreateWalletResponse = { data: { wallet: WalletSummary; metadata: WalletMetadata } };
type LinkWalletResponse = {
  data: { wallet: WalletSummary; mpcVerified: boolean; warning?: string };
};

type SetupMode = 'choose' | 'create' | 'link';

const CUSTODY_NOTICE =
  "This wallet is created using BitGo's MPC (Multi-Party Computation) infrastructure. Private keys are split into cryptographic shares and never exist in a single place. Our platform does not store private keys and cannot move funds independently.";

function WalletSetupPanel({ onComplete }: { onComplete: () => Promise<void> }) {
  const [mode, setMode] = useState<SetupMode>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create wallet form state
  const [label, setLabel] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');

  // Link wallet form state
  const [walletId, setWalletId] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      await apiClient.post<CreateWalletResponse>('/wallets/mpc', { label, passphrase });
      await onComplete();
    } catch {
      setError('Wallet creation failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data } = await apiClient.post<LinkWalletResponse>('/wallets/mpc/link', { walletId });
      if (!data.data.mpcVerified) {
        setError(data.data.warning ?? 'Wallet is not MPC-enabled.');
        setBusy(false);
        return;
      }
      await onComplete();
    } catch {
      setError('Wallet lookup failed. Check the wallet ID and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-light uppercase tracking-[0.24em] text-fuchsia-100/85">
            Wallet setup
          </div>
          <h1 className="app-section-title">Connect your wallet</h1>
          <p className="mt-3 text-sm leading-7 text-white/55">
            Create a new BitGo MPC wallet or link an existing one to get started.
          </p>
        </div>

        {mode === 'choose' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => setMode('create')}
              className="app-shell-panel rounded-[1.75rem] p-6 text-left transition-colors hover:border-fuchsia-400/30"
            >
              <div className="mb-3 text-2xl">✦</div>
              <h2 className="text-base font-light text-white">Create new wallet</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Generate a new BitGo MPC wallet. Private keys are split and never held in one place.
              </p>
            </button>

            <button
              onClick={() => setMode('link')}
              className="app-shell-panel rounded-[1.75rem] p-6 text-left transition-colors hover:border-fuchsia-400/30"
            >
              <div className="mb-3 text-2xl">⬡</div>
              <h2 className="text-base font-light text-white">Link existing wallet</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Already have a BitGo TBTC wallet? Enter its ID to link it to your account.
              </p>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="app-shell-panel rounded-[1.75rem] p-6">
            <button
              onClick={() => {
                setMode('choose');
                setError(null);
              }}
              className="mb-5 flex items-center gap-2 text-sm text-white/45 hover:text-white/70"
            >
              ← Back
            </button>
            <h2 className="text-lg font-light text-white">Create new wallet</h2>
            <form className="mt-5 space-y-3" onSubmit={handleCreate}>
              <input
                type="text"
                required
                placeholder="Wallet label (e.g. My TBTC Wallet)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="input-premium"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Wallet passphrase (min 8 chars)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="input-premium"
              />
              <input
                type="password"
                required
                placeholder="Confirm passphrase"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                className="input-premium"
              />
              {error && <p className="text-sm text-rose-300">{error}</p>}
              <p className="text-xs leading-5 text-amber-200/70">
                Store your passphrase securely — it encrypts your key share and cannot be recovered.
              </p>
              <button type="submit" disabled={busy} className="button-premium w-full">
                {busy ? 'Creating wallet…' : 'Create wallet'}
              </button>
            </form>
          </div>
        )}

        {mode === 'link' && (
          <div className="app-shell-panel rounded-[1.75rem] p-6">
            <button
              onClick={() => {
                setMode('choose');
                setError(null);
              }}
              className="mb-5 flex items-center gap-2 text-sm text-white/45 hover:text-white/70"
            >
              ← Back
            </button>
            <h2 className="text-lg font-light text-white">Link existing wallet</h2>
            <form className="mt-5 space-y-3" onSubmit={handleLink}>
              <input
                type="text"
                required
                placeholder="BitGo wallet ID"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="input-premium"
              />
              {error && <p className="text-sm text-rose-300">{error}</p>}
              <button type="submit" disabled={busy} className="button-premium w-full">
                {busy ? 'Verifying…' : 'Link wallet'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage(): React.JSX.Element {
  const [wallets, setWallets] = useState<WalletMetadata[]>([]);
  const [walletSummaries, setWalletSummaries] = useState<WalletSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  // Link-additional-wallet panel state
  const [showLink, setShowLink] = useState(false);
  const [linkWalletId, setLinkWalletId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkWarning, setLinkWarning] = useState<string | null>(null);

  const refreshWallets = async () => {
    const { data } = await apiClient.get<WalletListResponse>('/wallets/mpc');
    const newWallets: WalletMetadata[] = data.data.metadata;
    const newSummaries: WalletSummary[] = data.data.wallets;
    setWallets(newWallets);
    setWalletSummaries(newSummaries);
    // Keep current selection if still valid, otherwise fall back to first wallet
    setSelectedWalletId((prev) =>
      newWallets.some((w) => w.walletId === prev) ? prev : (newWallets[0]?.walletId ?? null)
    );
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshWallets();
      } catch {
        setError('Failed to load wallet data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeWallet = wallets.find((w) => w.walletId === selectedWalletId) ?? wallets[0] ?? null;
  const activeSummary =
    walletSummaries.find((s) => s.walletId === selectedWalletId) ?? walletSummaries[0] ?? null;

  const balanceValue = useMemo(() => {
    if (!activeSummary) return '0 sats';
    return `${activeSummary.balance} sats`;
  }, [activeSummary]);

  const onLinkAdditional = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLinking(true);
    setLinkWarning(null);
    setError(null);
    try {
      const { data } = await apiClient.post<LinkWalletResponse>('/wallets/mpc/link', {
        walletId: linkWalletId,
      });
      if (!data.data.mpcVerified) {
        setLinkWarning(data.data.warning ?? 'Wallet is not MPC-enabled.');
      } else {
        await refreshWallets();
        setLinkWalletId('');
        setShowLink(false);
      }
    } catch {
      setError('Wallet lookup failed. Please check the wallet ID and try again.');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-white/45">Loading…</p>
      </div>
    );
  }

  // No wallets yet — show onboarding choice
  if (wallets.length === 0) {
    return (
      <WalletSetupPanel
        onComplete={async () => {
          await refreshWallets();
        }}
      />
    );
  }

  // Has wallets — show dashboard
  return (
    <div className="space-y-8">
      <section className="app-shell-panel overflow-hidden rounded-[2rem] p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-light uppercase tracking-[0.24em] text-fuchsia-100/85">
              Wallet command center
            </div>
            <div>
              <h1 className="app-section-title">Internal dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55 md:text-base">
                Monitor balances, detect matched stealth outputs, and manage payment operations in
                one private control surface.
              </p>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-black/35 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-white/35">System status</div>
            <div className="mt-4 space-y-4 text-sm text-white/68">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>Supabase auth</span>
                <span className="text-emerald-300">Connected</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>BitGo network</span>
                <span className="text-amber-200">TBTC</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>MPC custody</span>
                <span className="text-fuchsia-200">
                  {activeSummary?.isMpc ? 'TSS verified' : 'Multi-key'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Balance', value: balanceValue },
          { label: 'Network', value: 'TBTC' },
          { label: 'Wallets linked', value: String(wallets.length) },
        ].map((s) => (
          <div key={s.label} className="metric-tile">
            <p className="text-sm text-white/48">{s.label}</p>
            <p className="mt-2 text-2xl font-light tracking-tight text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="app-shell-panel rounded-[1.75rem] p-6">
          <h2 className="text-lg font-light text-white">MPC Wallet Details</h2>
          {activeWallet && (
            <div className="mt-4 space-y-3 rounded-[1.25rem] border border-white/10 p-4 text-sm text-white/75">
              <div>
                <span className="text-white/45">Wallet ID:</span> {activeWallet.walletId}
              </div>
              <div>
                <span className="text-white/45">Label:</span> {activeWallet.walletLabel}
              </div>
              <div>
                <span className="text-white/45">Network:</span> TBTC
              </div>
              <div>
                <span className="text-white/45">Type:</span>{' '}
                {activeSummary?.isMpc
                  ? `MPC (${activeSummary.multisigType === 'tss' ? 'TSS' : 'multi-key'})`
                  : (activeWallet.walletType ?? 'Standard')}
              </div>
              <div>
                <span className="text-white/45">Receiving address:</span>{' '}
                {activeWallet.receiveAddress || 'Not generated yet'}
              </div>
              <div>
                <span className="text-white/45">Balance:</span>{' '}
                {activeSummary ? `${activeSummary.balance} sats` : '—'}
              </div>
            </div>
          )}
          <div className="mt-4 rounded-2xl border border-emerald-400/12 bg-emerald-400/8 p-4 text-sm leading-7 text-emerald-100/80">
            {CUSTODY_NOTICE}
          </div>
        </div>

        <div className="app-shell-panel rounded-[1.75rem] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-light text-white">Link another wallet</h2>
            <button
              onClick={() => {
                setShowLink((v) => !v);
                setLinkWarning(null);
              }}
              className="text-xs text-white/45 hover:text-white/70"
            >
              {showLink ? 'Cancel' : 'Add wallet'}
            </button>
          </div>

          {showLink ? (
            <form className="mt-4 space-y-3" onSubmit={onLinkAdditional}>
              <input
                type="text"
                required
                value={linkWalletId}
                onChange={(e) => setLinkWalletId(e.target.value)}
                className="input-premium"
                placeholder="Enter wallet ID"
              />
              {linkWarning && <p className="text-sm text-amber-200">{linkWarning}</p>}
              <button type="submit" className="button-premium w-full" disabled={linking}>
                {linking ? 'Verifying…' : 'Verify & link'}
              </button>
            </form>
          ) : (
            <div className="mt-4 space-y-2">
              {wallets.map((w) => {
                const isActive = w.walletId === activeWallet?.walletId;
                return (
                  <button
                    key={w.walletId}
                    onClick={() => setSelectedWalletId(w.walletId)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                      isActive
                        ? 'border-fuchsia-400/40 bg-fuchsia-400/10 text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p>{w.walletLabel}</p>
                      {isActive && (
                        <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/15 px-2 py-0.5 text-xs text-fuchsia-200">
                          active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-white/35">{w.walletId}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
