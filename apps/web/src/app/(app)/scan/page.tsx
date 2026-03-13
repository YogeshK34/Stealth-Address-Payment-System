export default function ScanPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-section-title">Scan blockchain activity</h1>
        <p className="mt-2 text-sm leading-7 text-white/55 md:text-base">
          Check recent transactions for payments addressed to your stealth address using your
          private view key.
        </p>
      </div>

      {/* TODO: wire up useScan mutation + useDetectedPayments query */}
      <div className="app-shell-panel flex flex-col gap-4 rounded-[1.75rem] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-light text-white">Detection loop</div>
          <div className="mt-1 text-sm text-white/50">
            Auto-scan every 30 seconds via scanner daemon
          </div>
        </div>
        <button className="button-premium">Run Scan Now</button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Scan cadence', value: '30 sec' },
          { label: 'Wallets monitored', value: '—' },
          { label: 'Matches detected', value: '—' },
        ].map((item) => (
          <div key={item.label} className="metric-tile">
            <div className="text-sm text-white/45">{item.label}</div>
            <div className="mt-2 text-3xl font-light tracking-tight text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <section className="app-shell-panel rounded-[1.75rem] p-6">
        <h2 className="text-lg font-light text-white">Detected Payments</h2>
        <div className="mt-4 rounded-[1.25rem] border border-white/10 divide-y divide-white/10">
          <p className="p-6 text-sm text-white/45 text-center">No payments detected yet.</p>
        </div>
      </section>
    </div>
  );
}
