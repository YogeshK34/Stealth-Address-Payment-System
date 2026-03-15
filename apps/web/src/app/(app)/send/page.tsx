'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { parseStealthMetaAddress } from '@/lib/stealth-meta-address';

type WalletOption = {
  id: string;
  walletId: string;
  walletLabel: string;
};

type WalletListResponse = {
  data: { metadata: WalletOption[] };
};

type PrepareResponse = {
  data: {
    stealthAddress: string; // Bitcoin P2WPKH address (tb1q…)
    ephemeralPublicKey: string; // 66-char compressed hex
    viewTag: string;
    amountSats: number;
  };
};

type SendResponse = {
  data: {
    txHash: string;
    stealthAddress: string;
    status: string;
  };
};

type Step = 'form' | 'confirm' | 'sending' | 'success' | 'error';

export default function SendPage(): React.JSX.Element {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(true);

  // Form fields
  const [senderWalletId, setSenderWalletId] = useState('');
  // Stealth meta-address pasted from the Receive page: st:btctest:0x<132hex>
  const [stealthInputRaw, setStealthInputRaw] = useState('');
  const [amountSats, setAmountSats] = useState('');
  const [walletPassphrase, setWalletPassphrase] = useState('');

  // Flow state
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prepared data
  const [prepared, setPrepared] = useState<PrepareResponse['data'] | null>(null);

  // Send result
  const [result, setResult] = useState<SendResponse['data'] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get<WalletListResponse>('/wallets/mpc');
        const list = data.data.metadata ?? [];
        setWallets(list);
        if (list[0]) setSenderWalletId(list[0].walletId);
      } catch {
        // wallets will remain empty
      } finally {
        setLoadingWallets(false);
      }
    })();
  }, []);

  const handlePrepare = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Parse the stealth meta-address: st:btctest:0x<viewKey_66hex><spendKey_66hex>
    const parseResult = parseStealthMetaAddress(stealthInputRaw);
    if (!parseResult) {
      setError(
        "Invalid stealth address. Paste the st:btctest:0x… address from the receiver's Receive page."
      );
      return;
    }
    const { viewKey: receiverViewKey, spendKey: receiverSpendKey } = parseResult;

    setBusy(true);
    try {
      const { data } = await apiClient.post<PrepareResponse>('/payments/prepare', {
        senderWalletId,
        receiverViewKey,
        receiverSpendKey,
        amountSats: Number(amountSats),
      });
      setPrepared(data.data);
      setStep('confirm');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to prepare payment.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!prepared) return;
    setError(null);
    setStep('sending');
    setBusy(true);

    try {
      const { data } = await apiClient.post<SendResponse>('/payments/send', {
        senderWalletId,
        stealthAddress: prepared.stealthAddress,
        ephemeralPublicKey: prepared.ephemeralPublicKey,
        viewTag: prepared.viewTag,
        amountSats: Number(amountSats),
        walletPassphrase,
      });
      setResult(data.data);
      setStep('success');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Transaction failed.';
      setError(msg);
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setStep('form');
    setPrepared(null);
    setResult(null);
    setError(null);
    setStealthInputRaw('');
    setAmountSats('');
    setWalletPassphrase('');
  };

  // --- Form step
  if (step === 'form') {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-6">
          <div>
            <h1 className="app-section-title">Send stealth payment</h1>
            <p className="mt-2 text-sm leading-7 text-white/55 md:text-base">
              Paste the receiver&apos;s stealth address and enter the amount. A unique one-time
              Bitcoin address will be derived — the receiver&apos;s real wallet is never exposed.
            </p>
          </div>

          <form
            className="app-shell-panel space-y-4 rounded-[1.75rem] p-6"
            onSubmit={handlePrepare}
          >
            {/* Wallet selector */}
            <div className="space-y-1">
              <label className="text-sm font-light text-white/80" htmlFor="wallet">
                Sender wallet
              </label>
              {loadingWallets ? (
                <p className="text-sm text-white/40">Loading wallets…</p>
              ) : wallets.length === 0 ? (
                <p className="text-sm text-amber-200">
                  No wallets found. Create one from the dashboard first.
                </p>
              ) : (
                <select
                  id="wallet"
                  value={senderWalletId}
                  onChange={(e) => setSenderWalletId(e.target.value)}
                  className="input-premium w-full"
                >
                  {wallets.map((w) => (
                    <option key={w.walletId} value={w.walletId}>
                      {w.walletLabel} ({w.walletId.slice(0, 8)}…)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Stealth address input */}
            <div className="space-y-1">
              <label className="text-sm font-light text-white/80" htmlFor="stealthAddr">
                Receiver stealth address
              </label>
              <textarea
                id="stealthAddr"
                required
                rows={3}
                placeholder="st:btctest:0x… (copy from the receiver's Receive page)"
                value={stealthInputRaw}
                onChange={(e) => setStealthInputRaw(e.target.value)}
                className="input-premium w-full resize-none font-mono text-xs"
              />
              <p className="text-xs text-white/35">
                Format: <span className="font-mono">st:btctest:0x&lt;132 hex chars&gt;</span> —
                stealth meta-address from the receiver&apos;s Receive page.
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-sm font-light text-white/80" htmlFor="amount">
                Amount (satoshis)
              </label>
              <input
                id="amount"
                type="number"
                min="1"
                required
                placeholder="100000"
                value={amountSats}
                onChange={(e) => setAmountSats(e.target.value)}
                className="input-premium"
              />
            </div>

            {/* Passphrase */}
            <div className="space-y-1">
              <label className="text-sm font-light text-white/80" htmlFor="passphrase">
                Wallet passphrase
              </label>
              <input
                id="passphrase"
                type="password"
                required
                placeholder="Your wallet passphrase"
                value={walletPassphrase}
                onChange={(e) => setWalletPassphrase(e.target.value)}
                className="input-premium"
              />
            </div>

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <button
              type="submit"
              disabled={busy || wallets.length === 0}
              className="button-premium w-full"
            >
              {busy ? 'Deriving one-time address…' : 'Prepare payment'}
            </button>
          </form>
        </div>

        {/* Right panel — steps */}
        <div className="app-shell-panel rounded-[1.75rem] p-6">
          <div className="text-sm font-light uppercase tracking-[0.22em] text-violet-100/70">
            How it works
          </div>
          <div className="mt-5 space-y-4">
            {[
              "Paste the receiver's stealth meta-address (st:btctest:0x…). It encodes their public keys — their real wallet stays hidden.",
              'The backend generates an ephemeral key and derives a unique one-time address via secp256k1 ECDH.',
              'Review the derived tb1q… address and confirm. Funds are sent via BitGo.',
              'The receiver can scan for the payment using their private view key.',
            ].map((text, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/35">
                  Step 0{index + 1}
                </div>
                <p className="mt-2 text-sm leading-7 text-white/60">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Confirm step
  if (step === 'confirm' && prepared) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="app-section-title">Confirm stealth payment</h1>
          <p className="mt-2 text-sm leading-7 text-white/55">
            Review the derived Bitcoin testnet address below. The receiver&apos;s real wallet is
            never revealed. Once you confirm, funds will be sent via BitGo.
          </p>
        </div>

        <div className="app-shell-panel space-y-5 rounded-[1.75rem] p-6">
          <div>
            <span className="text-xs font-light uppercase tracking-wide text-white/40">
              One-time Bitcoin address (tb1q…)
            </span>
            <p className="mt-2 break-all rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-4 font-mono text-sm text-fuchsia-100">
              {prepared.stealthAddress}
            </p>
          </div>

          <div>
            <span className="text-xs font-light uppercase tracking-wide text-white/40">
              Ephemeral public key (R)
            </span>
            <p className="mt-2 break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-white/70">
              {prepared.ephemeralPublicKey}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-light uppercase tracking-wide text-white/40">
                View tag
              </span>
              <p className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-amber-100">
                {prepared.viewTag}
              </p>
            </div>
            <div>
              <span className="text-xs font-light uppercase tracking-wide text-white/40">
                Amount
              </span>
              <p className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
                {prepared.amountSats.toLocaleString()} sats
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-400/12 bg-emerald-400/8 p-4 text-sm leading-7 text-emerald-100/80">
            This address is unique to this transaction. It cannot be linked to the receiver&apos;s
            identity or any previous payment.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setError(null);
              }}
              className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-light text-white/75 transition hover:bg-white/10"
            >
              Back
            </button>
            <button type="button" onClick={handleSend} className="button-premium">
              Confirm &amp; send
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Sending step
  if (step === 'sending') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-fuchsia-400/30 border-t-fuchsia-400" />
          <p className="text-sm text-white/55">Broadcasting transaction via BitGo…</p>
        </div>
      </div>
    );
  }

  // --- Success step
  if (step === 'success' && result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-3xl text-emerald-300">
            &#10003;
          </div>
          <h1 className="app-section-title">Payment sent</h1>
          <p className="mt-2 text-sm leading-7 text-white/55">
            Funds have been broadcast to the one-time Bitcoin testnet address.
          </p>
        </div>

        <div className="app-shell-panel space-y-4 rounded-[1.75rem] p-6">
          <div>
            <span className="text-xs font-light uppercase tracking-wide text-white/40">
              Transaction hash
            </span>
            <p className="mt-2 break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-white/70">
              {result.txHash}
            </p>
          </div>
          <div>
            <span className="text-xs font-light uppercase tracking-wide text-white/40">
              One-time stealth address
            </span>
            <p className="mt-2 break-all rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-4 font-mono text-sm text-fuchsia-100">
              {result.stealthAddress}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-amber-400/12 bg-amber-400/8 px-4 py-3 text-sm text-amber-100/80">
            Status: {result.status}
          </div>
        </div>

        <button type="button" onClick={resetForm} className="button-premium w-full">
          Send another payment
        </button>
      </div>
    );
  }

  // --- Error step
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/25 bg-rose-400/10 text-3xl text-rose-300">
          &#10007;
        </div>
        <h1 className="app-section-title">Transaction failed</h1>
        <p className="mt-2 text-sm leading-7 text-rose-200/70">{error}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={resetForm} className="button-premium w-full">
          Start over
        </button>
        <button
          type="button"
          onClick={() => {
            setStep('confirm');
            setError(null);
          }}
          className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-light text-white/75 transition hover:bg-white/10"
        >
          Retry send
        </button>
      </div>
    </div>
  );
}
