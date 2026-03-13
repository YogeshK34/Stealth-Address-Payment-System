'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

const publicViewKey = '02a7f4c2e90b91da1293d8f60df8b56b8c72a1185f5ae92e61bdf13f7e2f4790ab';
const publicSpendKey = '037dbe4b7627432d6c4b4f56ae9ec73f90c8cb15cf9cc5cb6b5d0d6ff13b3a1a9e';

export default function ReceivePage(): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const payload = `${publicViewKey}:${publicSpendKey}`;
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
      <div className="space-y-6">
        <div>
          <h1 className="app-section-title">Receive private payments</h1>
          <p className="mt-2 text-sm leading-7 text-white/55 md:text-base">
            Share your stealth address. Each sender will derive a unique one-time address — your
            identity is never revealed on-chain.
          </p>
        </div>

        {/* TODO: wire up useStealthAddress hook */}
        <div className="app-shell-panel space-y-5 rounded-[1.75rem] p-6">
          <div>
            <label className="text-xs font-light text-white/40 uppercase tracking-wide">
              Public View Key (A)
            </label>
            <p className="mt-2 break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-fuchsia-100">
              {publicViewKey}
            </p>
          </div>
          <div>
            <label className="text-xs font-light text-white/40 uppercase tracking-wide">
              Public Spend Key (B)
            </label>
            <p className="mt-2 break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-amber-100">
              {publicSpendKey}
            </p>
          </div>

          <button type="button" onClick={onCopy} className="button-premium w-full">
            {copied ? 'Copied' : 'Copy Stealth Address'}
          </button>
        </div>
      </div>

      <div className="app-shell-panel rounded-[1.75rem] p-6">
        <div className="text-sm font-light uppercase tracking-[0.22em] text-fuchsia-100/80">
          Shareable stealth card
        </div>
        <div className="mt-5 flex flex-col items-center rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="rounded-[1.5rem] bg-white p-4">
            <QRCodeSVG value={`${publicViewKey}:${publicSpendKey}`} size={184} includeMargin />
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/55">
            Senders only need your public stealth pair. Each payment still resolves to a different
            one-time destination.
          </p>
          <div className="mt-5 grid w-full gap-3">
            <div className="rounded-2xl border border-emerald-400/12 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100/80">
              Unlinkable outputs by default
            </div>
            <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-400/10 px-4 py-3 text-sm text-fuchsia-100/85">
              Receiver identity never appears as a static address
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
