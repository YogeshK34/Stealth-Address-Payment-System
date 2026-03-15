'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { formatStealthMetaAddress } from '@/lib/stealth-meta-address';
import {
  encryptSpendKey,
  decryptSpendKey,
  saveEncryptedSpendKey,
  loadEncryptedSpendKey,
  hasSpendKey,
} from '@/lib/spend-key-storage';
import { buildAndSignSweepTx } from '@/lib/client-sweep';

// ─── Types ────────────────────────────────────────────────────────────────────

type WalletOption = { id: string; walletId: string; walletLabel: string };
type WalletListResponse = { data: { metadata: WalletOption[] } };
type StealthKeysResponse = {
  data: { hasKeys: boolean; publicViewKey: string | null; publicSpendKey: string | null };
};
type GenerateKeysResponse = {
  data: { publicViewKey: string; publicSpendKey: string; spendPrivKey: string };
};
type ScannedPayment = {
  id: string;
  txHash: string;
  oneTimeAddress: string;
  sharedSecret: string;
  amountSats: number;
  status: string;
  createdAt: string;
};
type ScanApiResponse = {
  data: {
    scanned: number;
    found: number;
    payments: ScannedPayment[];
    destinationAddress: string | null;
  };
};
type BroadcastApiResponse = {
  data: { sweepTxHash: string; amountSats: number; feeSats: number };
};
type SweepResult = { sweepTxHash: string; amountSats: number; feeSats: number };

// State for the inline passphrase prompt per payment
type SweepPromptState =
  | { phase: 'idle' }
  | { phase: 'passphrase'; passphrase: string; manualKey: string; showManual: boolean }
  | { phase: 'signing' }
  | { phase: 'done'; result: SweepResult }
  | { phase: 'error'; message: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReceivePage(): React.JSX.Element {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [loadingWallets, setLoadingWallets] = useState(true);

  const [publicViewKey, setPublicViewKey] = useState<string | null>(null);
  const [publicSpendKey, setPublicSpendKey] = useState<string | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [localKeyPresent, setLocalKeyPresent] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // ── Key setup panel (shown once after keygen, to save spend key) ──────────
  const [keySetupSpendKey, setKeySetupSpendKey] = useState<string | null>(null);
  const [keySetupPassphrase, setKeySetupPassphrase] = useState('');
  const [keySetupConfirm, setKeySetupConfirm] = useState('');
  const [keySetupError, setKeySetupError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [showRawKey, setShowRawKey] = useState(false);
  const [rawKeyCopied, setRawKeyCopied] = useState(false);

  // ── Scanning state ────────────────────────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    scanned: number;
    found: number;
    payments: ScannedPayment[];
    destinationAddress: string | null;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // ── Per-payment sweep state ───────────────────────────────────────────────
  const [sweepStates, setSweepStates] = useState<Record<string, SweepPromptState>>({});

  const stealthMetaAddress =
    publicViewKey && publicSpendKey
      ? formatStealthMetaAddress(publicViewKey, publicSpendKey, 'btctest')
      : null;

  // Check if spend key is in localStorage whenever the selected wallet changes
  const refreshLocalKeyStatus = useCallback((walletId: string) => {
    setLocalKeyPresent(hasSpendKey(walletId));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get<WalletListResponse>('/wallets/mpc');
        const list: WalletOption[] = data.data.metadata ?? [];
        setWallets(list);
        if (list[0]) setSelectedWalletId(list[0].walletId);
      } catch {
        setError('Failed to load wallets.');
      } finally {
        setLoadingWallets(false);
      }
    })();
  }, []);

  const fetchKeys = useCallback(
    async (walletId: string) => {
      setPublicViewKey(null);
      setPublicSpendKey(null);
      setError(null);
      setScanResult(null);
      setScanError(null);
      setKeySetupSpendKey(null);
      setLoadingKeys(true);
      try {
        const { data } = await apiClient.get<StealthKeysResponse>(
          `/stealth/keygen-wallet?walletId=${walletId}`
        );
        if (data.data.hasKeys) {
          setPublicViewKey(data.data.publicViewKey);
          setPublicSpendKey(data.data.publicSpendKey);
        }
      } catch {
        // no keys yet
      } finally {
        setLoadingKeys(false);
        refreshLocalKeyStatus(walletId);
      }
    },
    [refreshLocalKeyStatus]
  );

  useEffect(() => {
    if (selectedWalletId) fetchKeys(selectedWalletId);
  }, [selectedWalletId, fetchKeys]);

  // ── Key generation ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!selectedWalletId) return;
    setError(null);
    setGenerating(true);
    try {
      const { data } = await apiClient.post<GenerateKeysResponse>('/stealth/keygen-wallet', {
        walletId: selectedWalletId,
      });
      setPublicViewKey(data.data.publicViewKey);
      setPublicSpendKey(data.data.publicSpendKey);
      // Capture the spend key for the one-time save prompt
      setKeySetupSpendKey(data.data.spendPrivKey);
      setKeySetupPassphrase('');
      setKeySetupConfirm('');
      setKeySetupError(null);
    } catch {
      setError('Failed to generate stealth keys. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Spend key save flow ───────────────────────────────────────────────────

  const handleSaveSpendKey = async () => {
    if (!keySetupSpendKey || !selectedWalletId) return;
    setKeySetupError(null);
    if (keySetupPassphrase.length < 8) {
      setKeySetupError('Passphrase must be at least 8 characters.');
      return;
    }
    if (keySetupPassphrase !== keySetupConfirm) {
      setKeySetupError('Passphrases do not match.');
      return;
    }
    setSavingKey(true);
    try {
      const blob = await encryptSpendKey(keySetupSpendKey, keySetupPassphrase);
      saveEncryptedSpendKey(selectedWalletId, blob);
      setLocalKeyPresent(true);
      setKeySetupSpendKey(null);
      setKeySetupPassphrase('');
      setKeySetupConfirm('');
    } catch {
      setKeySetupError('Encryption failed. Please try again.');
    } finally {
      setSavingKey(false);
    }
  };

  // ── Scanning ──────────────────────────────────────────────────────────────

  const handleScan = async () => {
    if (!selectedWalletId) return;
    setScanError(null);
    setScanResult(null);
    setSweepStates({});
    setScanning(true);
    try {
      const { data } = await apiClient.post<ScanApiResponse>('/payments/scan', {
        walletId: selectedWalletId,
      });
      setScanResult(data.data);
      // Initialise sweep prompt state for each found payment
      const initial: Record<string, SweepPromptState> = {};
      for (const p of data.data.payments) {
        initial[p.txHash] = { phase: 'idle' };
      }
      setSweepStates(initial);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  // ── Sweep ─────────────────────────────────────────────────────────────────

  const setSweepState = (txHash: string, state: SweepPromptState) => {
    setSweepStates((prev) => ({ ...prev, [txHash]: state }));
  };

  const handleSweepClick = (payment: ScannedPayment) => {
    setSweepState(payment.txHash, {
      phase: 'passphrase',
      passphrase: '',
      manualKey: '',
      showManual: !localKeyPresent,
    });
  };

  const handleSweepConfirm = async (payment: ScannedPayment) => {
    const state = sweepStates[payment.txHash];
    if (!state || state.phase !== 'passphrase') return;

    setSweepState(payment.txHash, { phase: 'signing' });

    try {
      // Retrieve and decrypt the spend private key
      let spendPrivKey: string;
      if (state.showManual) {
        // User entered key manually
        spendPrivKey = state.manualKey.trim();
        if (!/^[0-9a-fA-F]{64}$/.test(spendPrivKey)) {
          throw new Error('Spend key must be a 64-character hex string.');
        }
      } else {
        const blob = loadEncryptedSpendKey(selectedWalletId);
        if (!blob) throw new Error('Spend key not found in browser storage.');
        spendPrivKey = await decryptSpendKey(blob, state.passphrase);
      }

      const destination = scanResult?.destinationAddress;
      if (!destination) throw new Error('No destination address found for this wallet.');

      // Build and sign the transaction entirely in the browser
      const { rawTxHex, sweepAmountSats, feeSats } = await buildAndSignSweepTx({
        sharedSecret: payment.sharedSecret,
        spendPrivKey,
        oneTimeAddress: payment.oneTimeAddress,
        destinationAddress: destination,
      });

      // POST the signed hex to the server — server only broadcasts, no key access
      const { data } = await apiClient.post<BroadcastApiResponse>('/payments/broadcast', {
        walletId: selectedWalletId,
        rawTxHex,
        oneTimeAddress: payment.oneTimeAddress,
        originalTxHash: payment.txHash,
        amountSats: sweepAmountSats,
        feeSats,
      });

      setSweepState(payment.txHash, {
        phase: 'done',
        result: data.data,
      });

      // Refresh scan to reflect 'swept' status
      if (scanResult) {
        setScanResult({
          ...scanResult,
          payments: scanResult.payments.map((p) =>
            p.txHash === payment.txHash ? { ...p, status: 'swept' } : p
          ),
        });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message.includes('Decryption')
            ? 'Wrong passphrase — decryption failed.'
            : err.message
          : 'Sweep failed. Please try again.';
      setSweepState(payment.txHash, { phase: 'error', message: msg });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!stealthMetaAddress) return;
    await navigator.clipboard.writeText(stealthMetaAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyRawKey = async () => {
    if (!keySetupSpendKey) return;
    await navigator.clipboard.writeText(keySetupSpendKey);
    setRawKeyCopied(true);
    setTimeout(() => setRawKeyCopied(false), 1500);
  };

  if (loadingWallets) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-white/45">Loading wallets…</p>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <h1 className="app-section-title">No wallets found</h1>
          <p className="mt-3 text-sm leading-7 text-white/55">
            Create or link a wallet from the dashboard before generating stealth keys.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Key setup panel (one-time, shown immediately after key generation) ── */}
      {keySetupSpendKey && (
        <div className="app-shell-panel rounded-[1.75rem] border border-amber-400/25 bg-amber-400/5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-medium text-amber-200">Save your spend key</h2>
            <p className="text-sm leading-6 text-amber-100/70">
              This key is shown <strong>once</strong> and is never stored on the server. Encrypt it
              with a passphrase — it will be saved to this browser and used to sign sweeps locally.
            </p>
          </div>

          {/* Raw key backup */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowRawKey((v) => !v)}
              className="text-xs text-amber-200/60 hover:text-amber-200/90"
            >
              {showRawKey ? 'Hide raw key' : 'Show raw key for manual backup'} ▾
            </button>
            {showRawKey && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-black/30 p-3">
                <p className="flex-1 break-all font-mono text-xs text-amber-100/70">
                  {keySetupSpendKey}
                </p>
                <button
                  type="button"
                  onClick={handleCopyRawKey}
                  className="shrink-0 rounded-lg border border-amber-400/20 px-2 py-1 text-xs text-amber-200/70 hover:text-amber-200"
                >
                  {rawKeyCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          {/* Passphrase inputs */}
          <div className="mt-4 space-y-3">
            <input
              type="password"
              placeholder="Encryption passphrase (min 8 chars)"
              value={keySetupPassphrase}
              onChange={(e) => setKeySetupPassphrase(e.target.value)}
              className="input-premium"
            />
            <input
              type="password"
              placeholder="Confirm passphrase"
              value={keySetupConfirm}
              onChange={(e) => setKeySetupConfirm(e.target.value)}
              className="input-premium"
            />
            {keySetupError && <p className="text-sm text-rose-300">{keySetupError}</p>}
            <button
              type="button"
              onClick={handleSaveSpendKey}
              disabled={savingKey || !keySetupPassphrase || !keySetupConfirm}
              className="button-premium w-full"
            >
              {savingKey ? 'Encrypting & saving…' : 'Encrypt & Save to Browser'}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-6">
          <div>
            <h1 className="app-section-title">Receive private payments</h1>
            <p className="mt-2 text-sm leading-7 text-white/55 md:text-base">
              Generate your stealth address once and share it publicly. Each sender derives a unique
              one-time Bitcoin address — your real wallet is never revealed on-chain.
            </p>
          </div>

          {wallets.length > 1 && (
            <div className="space-y-1">
              <label className="text-sm font-light text-white/70" htmlFor="walletSelect">
                Select wallet
              </label>
              <select
                id="walletSelect"
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="input-premium w-full"
              >
                {wallets.map((w) => (
                  <option key={w.walletId} value={w.walletId}>
                    {w.walletLabel} ({w.walletId.slice(0, 8)}…)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="app-shell-panel space-y-5 rounded-[1.75rem] p-6">
            {loadingKeys ? (
              <p className="text-sm text-white/45">Loading stealth address…</p>
            ) : stealthMetaAddress ? (
              <>
                <div>
                  <label className="text-xs font-light uppercase tracking-wide text-white/40">
                    Your stealth address
                  </label>
                  <p className="mt-2 break-all rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-4 font-mono text-xs leading-6 text-fuchsia-100">
                    {stealthMetaAddress}
                  </p>
                </div>

                {/* Local key status indicator */}
                <div
                  className={`rounded-2xl border p-4 text-xs leading-6 ${
                    localKeyPresent
                      ? 'border-emerald-400/15 bg-emerald-400/8 text-emerald-100/80'
                      : 'border-amber-400/20 bg-amber-400/8 text-amber-100/80'
                  }`}
                >
                  {localKeyPresent
                    ? 'Spend key is saved in this browser. Sweeps are signed locally — the server never sees your private key.'
                    : 'Spend key not found in this browser. You will need to enter it manually to sweep payments.'}
                </div>

                <button type="button" onClick={handleCopy} className="button-premium w-full">
                  {copied ? 'Copied!' : 'Copy Stealth Address'}
                </button>

                <div className="border-t border-white/8 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalDetails((v) => !v)}
                    className="flex w-full items-center justify-between text-xs text-white/35 hover:text-white/55"
                  >
                    <span>Technical details</span>
                    <span>{showTechnicalDetails ? '▲' : '▼'}</span>
                  </button>
                  {showTechnicalDetails && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs font-light uppercase tracking-wide text-white/30">
                          Public view key (A = a·G)
                        </label>
                        <p className="mt-1 break-all rounded-xl border border-white/8 bg-black/20 p-3 font-mono text-xs text-white/50">
                          {publicViewKey}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-light uppercase tracking-wide text-white/30">
                          Public spend key (B = b·G)
                        </label>
                        <p className="mt-1 break-all rounded-xl border border-white/8 bg-black/20 p-3 font-mono text-xs text-white/50">
                          {publicSpendKey}
                        </p>
                      </div>
                      <p className="text-xs leading-5 text-white/30">
                        Spend private key is held only in this browser, encrypted with your
                        passphrase. The server holds the view key for scanning only.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-amber-400/12 bg-amber-400/8 p-4 text-sm leading-7 text-amber-100/80">
                  No stealth address found for this wallet. Generate one to start receiving private
                  Bitcoin payments.
                </div>
                {error && <p className="text-sm text-rose-300">{error}</p>}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="button-premium w-full"
                >
                  {generating ? 'Generating stealth address…' : 'Generate Stealth Address'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="app-shell-panel rounded-[1.75rem] p-6">
          <div className="text-sm font-light uppercase tracking-[0.22em] text-fuchsia-100/80">
            Shareable stealth card
          </div>
          <div className="mt-5 flex flex-col items-center rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 text-center">
            {stealthMetaAddress ? (
              <>
                <div className="rounded-[1.5rem] bg-white p-4">
                  <QRCodeSVG value={stealthMetaAddress} size={184} includeMargin />
                </div>
                <p className="mt-4 break-all font-mono text-xs text-white/35">
                  {stealthMetaAddress.slice(0, 24)}…
                </p>
              </>
            ) : (
              <div className="flex h-[216px] w-[216px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/5 text-sm text-white/30">
                Generate address to show QR
              </div>
            )}
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/55">
              Senders paste your stealth address into the Send page. Each payment resolves to a
              different one-time Bitcoin testnet address — unlinkable by design.
            </p>
            <div className="mt-5 grid w-full gap-3">
              <div className="rounded-2xl border border-emerald-400/12 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100/80">
                Non-custodial — spend key never leaves browser
              </div>
              <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-400/10 px-4 py-3 text-sm text-fuchsia-100/85">
                Bitcoin testnet (tb1q…) compatible
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Incoming Payments (Scan & Sweep) ── */}
      {stealthMetaAddress && (
        <div className="app-shell-panel space-y-5 rounded-[1.75rem] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-white/90">Incoming payments</h2>
              <p className="mt-1 text-xs leading-5 text-white/45">
                Scan for stealth payments addressed to your keys, then sweep them into your wallet.
                Signing happens entirely in your browser.
              </p>
            </div>
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning}
              className="button-premium shrink-0"
            >
              {scanning ? 'Scanning…' : 'Scan for Payments'}
            </button>
          </div>

          {scanError && (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/8 p-4 text-sm text-rose-300">
              {scanError}
            </div>
          )}

          {scanResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs text-white/45">
                <span>
                  Scanned <span className="font-medium text-white/70">{scanResult.scanned}</span>{' '}
                  transaction{scanResult.scanned !== 1 ? 's' : ''}
                </span>
                <span className="text-white/20">·</span>
                <span>
                  Found <span className="font-medium text-emerald-400">{scanResult.found}</span>{' '}
                  payment{scanResult.found !== 1 ? 's' : ''} for this wallet
                </span>
              </div>

              {scanResult.found === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-center text-sm text-white/40">
                  No incoming payments found. Payments appear once a sender broadcasts to your
                  stealth address.
                </div>
              ) : (
                <div className="space-y-3">
                  {scanResult.payments.map((payment) => {
                    const pState = sweepStates[payment.txHash] ?? { phase: 'idle' };
                    const alreadySwept = payment.status === 'swept' || pState.phase === 'done';

                    return (
                      <div
                        key={payment.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4"
                      >
                        {/* Payment summary */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white/90">
                                {payment.amountSats.toLocaleString()} sats
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-light ${
                                  alreadySwept
                                    ? 'bg-emerald-400/15 text-emerald-300'
                                    : payment.status === 'confirmed'
                                      ? 'bg-sky-400/15 text-sky-300'
                                      : 'bg-amber-400/12 text-amber-300'
                                }`}
                              >
                                {pState.phase === 'done'
                                  ? 'swept'
                                  : alreadySwept
                                    ? 'swept'
                                    : payment.status}
                              </span>
                            </div>
                            <p className="truncate font-mono text-xs text-white/35">
                              one-time: {payment.oneTimeAddress}
                            </p>
                            <p className="truncate font-mono text-xs text-white/25">
                              tx: {payment.txHash}
                            </p>
                          </div>
                        </div>

                        {/* Sweep done */}
                        {pState.phase === 'done' && (
                          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/8 p-3 space-y-1">
                            <p className="text-xs font-medium text-emerald-300">
                              Swept — signed in your browser, never sent to server
                            </p>
                            <p className="font-mono text-xs text-emerald-100/60 break-all">
                              sweep tx: {pState.result.sweepTxHash}
                            </p>
                            <p className="text-xs text-emerald-100/50">
                              {pState.result.amountSats.toLocaleString()} sats received · fee{' '}
                              {pState.result.feeSats} sats
                            </p>
                          </div>
                        )}

                        {/* Error */}
                        {pState.phase === 'error' && (
                          <div className="space-y-2">
                            <p className="text-xs text-rose-300">{pState.message}</p>
                            <button
                              type="button"
                              onClick={() => handleSweepClick(payment)}
                              className="text-xs text-white/40 hover:text-white/60"
                            >
                              Try again
                            </button>
                          </div>
                        )}

                        {/* Passphrase prompt */}
                        {pState.phase === 'passphrase' && (
                          <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
                            <p className="text-xs font-medium text-white/70">
                              Sign sweep transaction
                            </p>
                            <p className="text-xs text-white/45">
                              The transaction will be built and signed entirely in your browser.
                              Your spend key decrypted locally and never sent to the server.
                            </p>

                            {pState.showManual ? (
                              <>
                                <input
                                  type="password"
                                  placeholder="Spend private key (64-char hex)"
                                  value={pState.manualKey}
                                  onChange={(e) =>
                                    setSweepState(payment.txHash, {
                                      ...pState,
                                      manualKey: e.target.value,
                                    })
                                  }
                                  className="input-premium font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSweepState(payment.txHash, {
                                      ...pState,
                                      showManual: false,
                                    })
                                  }
                                  className="text-xs text-white/35 hover:text-white/55"
                                >
                                  Use saved browser key instead
                                </button>
                              </>
                            ) : (
                              <>
                                <input
                                  type="password"
                                  placeholder="Spend key passphrase"
                                  value={pState.passphrase}
                                  onChange={(e) =>
                                    setSweepState(payment.txHash, {
                                      ...pState,
                                      passphrase: e.target.value,
                                    })
                                  }
                                  className="input-premium"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSweepState(payment.txHash, {
                                      ...pState,
                                      showManual: true,
                                    })
                                  }
                                  className="text-xs text-white/35 hover:text-white/55"
                                >
                                  Enter spend key manually instead
                                </button>
                              </>
                            )}

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSweepConfirm(payment)}
                                disabled={
                                  pState.showManual
                                    ? pState.manualKey.length < 64
                                    : pState.passphrase.length === 0
                                }
                                className="flex-1 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/10 py-2 text-sm text-fuchsia-200 hover:bg-fuchsia-400/18 disabled:opacity-50 transition-colors"
                              >
                                Sign & Sweep
                              </button>
                              <button
                                type="button"
                                onClick={() => setSweepState(payment.txHash, { phase: 'idle' })}
                                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/40 hover:text-white/60"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Signing in progress */}
                        {pState.phase === 'signing' && (
                          <div className="rounded-xl border border-fuchsia-400/15 bg-fuchsia-400/8 p-3 text-xs text-fuchsia-200/80">
                            Building and signing transaction in your browser…
                          </div>
                        )}

                        {/* Initial sweep button */}
                        {pState.phase === 'idle' && !alreadySwept && (
                          <div className="space-y-2">
                            {scanResult.destinationAddress && (
                              <p className="text-xs text-white/35">
                                Destination:{' '}
                                <span className="font-mono text-white/55">
                                  {scanResult.destinationAddress.slice(0, 22)}…
                                </span>
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSweepClick(payment)}
                              className="w-full rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/10 py-2 text-sm text-fuchsia-200 hover:bg-fuchsia-400/18 transition-colors"
                            >
                              Sweep to Wallet
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
