export default function SendPage(): React.JSX.Element {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
      <div className="space-y-6">
        <div>
          <h1 className="app-section-title">Send stealth payment</h1>
          <p className="mt-2 text-sm leading-7 text-white/55 md:text-base">
            Enter the receiver&apos;s stealth address and amount. A unique one-time address will be
            derived automatically.
          </p>
        </div>

        {/* TODO: wire up useSendPayment mutation */}
        <form className="app-shell-panel space-y-4 rounded-[1.75rem] p-6">
          <div className="space-y-1">
            <label className="text-sm font-light text-white/80" htmlFor="viewKey">
              Receiver Public View Key (A)
            </label>
            <input
              id="viewKey"
              type="text"
              placeholder="02abc..."
              className="input-premium font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-light text-white/80" htmlFor="spendKey">
              Receiver Public Spend Key (B)
            </label>
            <input
              id="spendKey"
              type="text"
              placeholder="03def..."
              className="input-premium font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-light text-white/80" htmlFor="amount">
              Amount (satoshis)
            </label>
            <input
              id="amount"
              type="number"
              min="1000"
              placeholder="100000"
              className="input-premium"
            />
          </div>

          <button type="submit" className="button-premium w-full">
            Derive Address & Send
          </button>
        </form>
      </div>

      <div className="app-shell-panel rounded-[1.75rem] p-6">
        <div className="text-sm font-light uppercase tracking-[0.22em] text-violet-100/70">
          What happens next
        </div>
        <div className="mt-5 space-y-4">
          {[
            'A fresh ephemeral key is generated for this payment.',
            'A one-time destination address is derived from the receiver stealth pair.',
            'The ephemeral public key is embedded so the receiver scanner can detect the payment.',
          ].map((step, index) => (
            <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/35">
                Step 0{index + 1}
              </div>
              <p className="mt-2 text-sm leading-7 text-white/60">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
