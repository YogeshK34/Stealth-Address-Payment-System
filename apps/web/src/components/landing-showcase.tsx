import {
  Building2,
  ChartNoAxesCombined,
  Cpu,
  Globe,
  Rocket,
  Scan,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

const logos = ['FINLAB', 'CHAINOPS', 'WALLETGRID', 'BLOCKHAVEN', 'CRYPTOSHIELD', 'NEXUS PAY'];

const useCases = [
  {
    icon: ShieldCheck,
    title: 'Treasury-ready settlement',
    body: 'Reduce address-linking risk for high-value flows while keeping operator controls clean.',
  },
  {
    icon: Building2,
    title: 'Partner payouts',
    body: 'Ship merchant payouts over Bitcoin rails with less public payment graph exposure.',
  },
  {
    icon: Globe,
    title: 'Cross-border collections',
    body: 'Accept global BTC payments with tighter metadata boundaries.',
  },
];

const systemStats = [
  { label: 'Stealth keypair split', value: 'View + Spend' },
  { label: 'Address derivation', value: 'ECDH + Hash map' },
  { label: 'Scanner cadence', value: 'Near real-time' },
  { label: 'API architecture', value: 'Typed + modular' },
];

const highlights = [
  {
    icon: Rocket,
    title: 'Launch-ready interface',
    body: 'Polished surfaces and decisive CTAs from the first screen.',
  },
  {
    icon: Scan,
    title: 'Motion-led storytelling',
    body: 'Scroll reveals and hover depth keep technical content intuitive.',
  },
  {
    icon: Cpu,
    title: 'Composable architecture',
    body: 'Modular sections support rapid iteration without layout churn.',
  },
];

export function LandingShowcase(): React.JSX.Element {
  return (
    <>
      <section id="signal" className="relative px-6 py-20 md:px-8" data-reveal>
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-fuchsia-100/85">
              <Sparkles className="h-3.5 w-3.5" />
              Platform Signal
            </div>
            <h2 className="text-3xl font-light tracking-tight text-white md:text-5xl">
              Premium visuals and modern motion tuned for crypto-native trust.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4" data-reveal>
            {systemStats.map((stat) => (
              <div key={stat.label} className="glass-panel rounded-[1.6rem] p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">{stat.label}</div>
                <div className="mt-3 text-lg font-light text-white">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="glass-panel overflow-hidden rounded-[1.8rem] p-5" data-reveal>
            <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/45">
              <ChartNoAxesCombined className="h-3.5 w-3.5" />
              Visual partner cloud
            </div>
            <div className="relative overflow-hidden">
              <div className="animate-[marquee_24s_linear_infinite] whitespace-nowrap">
                {[...logos, ...logos].map((logo, index) => (
                  <span
                    key={`${logo}-${index}`}
                    className="mx-2 inline-flex rounded-full border border-white/12 bg-white/5 px-5 py-2 text-sm font-light tracking-[0.16em] text-white/75"
                  >
                    {logo}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="experience" className="relative px-6 py-20 md:px-8" data-reveal>
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="glass-panel rounded-[1.8rem] p-6" data-reveal>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400/20 to-amber-300/15 text-fuchsia-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-light text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/55">{item.body}</p>
                </article>
              );
            })}
          </div>

          <div className="space-y-5" data-reveal>
            <div className="glass-panel rounded-[1.8rem] p-6">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-100">
                <Zap className="h-3.5 w-3.5" />
                Specialized use cases
              </div>

              <div className="space-y-4">
                {useCases.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5"
                      data-reveal
                    >
                      <div className="flex items-center gap-2 text-sm font-light text-white">
                        <Icon className="h-4 w-4 text-cyan-200" />
                        {item.title}
                      </div>
                      <p className="mt-3 text-sm leading-7 text-white/55">{item.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
