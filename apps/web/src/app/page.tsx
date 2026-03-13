import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Bitcoin,
  Blocks,
  Eye,
  Fingerprint,
  LockKeyhole,
  Orbit,
  Radar,
  ScanLine,
  Shield,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { LandingFaq } from '@/components/landing-faq';
import { LandingFooter } from '@/components/landing-footer';
import { LandingInsights } from '@/components/landing-insights';
import { LandingMotion } from '@/components/landing-motion';
import { LandingNavbar } from '@/components/landing-navbar';
import { LandingPricing } from '@/components/landing-pricing';
import { LandingShowcase } from '@/components/landing-showcase';
import { LandingTestimonials } from '@/components/landing-testimonials';

const featureCards = [
  {
    icon: Fingerprint,
    title: 'Unlinkable by design',
    description: 'Each payment derives a fresh destination so reuse patterns disappear.',
  },
  {
    icon: Shield,
    title: 'BitGo-backed execution',
    description: 'Wallet creation and transfers stay on proven infrastructure rails.',
  },
  {
    icon: Eye,
    title: 'View-key scanning',
    description: 'Receivers detect inbound funds privately with isolated key boundaries.',
  },
  {
    icon: Radar,
    title: 'Real-time scanner loop',
    description: 'Scanner services monitor transactions and resolve ownership quickly.',
  },
  {
    icon: LockKeyhole,
    title: 'Cryptographic privacy layer',
    description: 'ECDH derivation protects linkability without changing Bitcoin itself.',
  },
  {
    icon: Wallet,
    title: 'Built for shipping',
    description: 'Typed APIs, auth boundaries, and modular services support fast iteration.',
  },
] as const;

const steps = [
  {
    id: '01',
    title: 'Publish a stealth address',
    text: 'The receiver shares public view and spend keys without reusing static receive addresses.',
  },
  {
    id: '02',
    title: 'Derive a one-time output',
    text: 'The sender creates an ephemeral key and computes a unique on-chain destination.',
  },
  {
    id: '03',
    title: 'Scan and detect privately',
    text: 'Scanner services inspect outputs with the view key and detect inbound funds.',
  },
] as const;

export default function HomePage(): React.JSX.Element {
  return (
    <main className="relative overflow-hidden text-white">
      <LandingNavbar />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-grid absolute inset-0 opacity-40" />
        <div className="animate-float-slow absolute left-[8%] top-32 h-72 w-72 rounded-full bg-cyan-400/18 blur-[120px]" />
        <div className="animate-float-delay absolute right-[10%] top-28 h-80 w-80 rounded-full bg-violet-500/16 blur-[140px]" />
        <div className="animate-pulse-soft absolute bottom-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/12 blur-[120px]" />
      </div>

      <section className="relative px-6 pb-24 pt-32 md:px-8 md:pb-32 md:pt-40" data-reveal>
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-light uppercase tracking-[0.28em] text-cyan-100/80 backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Stealth-address payments for Bitcoin
            </div>

            <div className="space-y-6">
              <h1 className="max-w-4xl text-5xl font-light leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl md:text-7xl">
                Private Bitcoin payments with
                <span className="text-gradient-premium"> hyper-modern product UX</span>.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/62 md:text-xl">
                Every inbound payment resolves to a fresh destination. Privacy architecture and
                premium interface design move together.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-400 via-rose-300 to-amber-200 px-6 py-3.5 text-sm font-light text-black shadow-[0_20px_60px_rgba(251,191,36,0.28)] transition hover:scale-[1.02]"
              >
                Open internal dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 px-6 py-3.5 text-sm font-light text-white/88 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/8"
              >
                Sign in
              </Link>
            </div>

            <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                'Fresh destination per payment',
                'Scanner-backed inbound detection',
                'Supabase auth + BitGo rails',
              ].map((item) => (
                <div
                  key={item}
                  className="glass-panel rounded-2xl px-4 py-4 text-sm text-white/70"
                  data-glow
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative" data-reveal>
            <div
              className="glass-panel shadow-glow-cyan relative overflow-hidden rounded-[2rem] p-6 md:p-7"
              data-glow
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/38">
                    Live payment surface
                  </div>
                  <div className="mt-2 text-xl font-light text-white">Privacy orchestration</div>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-light text-emerald-200">
                  Scanner active
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                  <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/35">
                    <span>Derived payment route</span>
                    <span>ECDH</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-400/10 bg-cyan-400/8 p-4">
                    <div>
                      <div className="text-xs text-white/45">Receiver stealth address</div>
                      <div className="mt-1 font-mono text-sm text-cyan-100">A + B public keys</div>
                    </div>
                    <Orbit className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div className="mx-auto my-3 h-10 w-px bg-gradient-to-b from-cyan-300/70 to-violet-400/10" />
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-400/10 bg-violet-400/8 p-4">
                    <div>
                      <div className="text-xs text-white/45">One-time address</div>
                      <div className="mt-1 font-mono text-sm text-violet-100">P = H(r·A)·G + B</div>
                    </div>
                    <Bitcoin className="h-5 w-5 text-violet-300" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5" data-glow>
                    <div className="flex items-center gap-2 text-sm font-light text-white/85">
                      <ScanLine className="h-4 w-4 text-cyan-300" />
                      Detection loop
                    </div>
                    <div className="mt-4 text-3xl font-light tracking-tight">30s</div>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Near real-time scan cadence for fast feedback.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5" data-glow>
                    <div className="flex items-center gap-2 text-sm font-light text-white/85">
                      <BadgeCheck className="h-4 w-4 text-emerald-300" />
                      Privacy invariant
                    </div>
                    <div className="mt-4 text-3xl font-light tracking-tight">1 tx → 1 address</div>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Every transfer gets a fresh ephemeral destination.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative px-6 py-20 md:px-8" data-reveal>
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl space-y-4">
            <div className="text-sm font-light uppercase tracking-[0.26em] text-cyan-200/70">
              Premium capability stack
            </div>
            <h2 className="text-3xl font-light tracking-tight text-white md:text-5xl">
              Built to look as advanced as the cryptography beneath it.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-reveal>
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="glass-panel group rounded-[1.75rem] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/15 hover:bg-white/10"
                  data-glow
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/18 to-violet-400/18 text-cyan-200 transition group-hover:scale-105 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-light text-white">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/55">{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="flow" className="relative px-6 py-20 md:px-8" data-reveal>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-5">
            <div className="text-sm font-light uppercase tracking-[0.26em] text-violet-200/70">
              Payment flow
            </div>
            <h2 className="text-3xl font-light tracking-tight text-white md:text-5xl">
              Sender simplicity. Receiver privacy. Scanner intelligence.
            </h2>
          </div>

          <div className="space-y-5" data-reveal>
            {steps.map((step) => (
              <div key={step.id} className="glass-panel rounded-[1.75rem] p-6 md:p-7" data-glow>
                <div className="flex items-start gap-5">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-light text-cyan-200">
                    {step.id}
                  </div>
                  <div>
                    <h3 className="text-xl font-light text-white">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/55">{step.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="proof" className="relative px-6 py-20 md:px-8" data-reveal>
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="glass-panel rounded-[2rem] p-7 md:p-8" data-glow>
            <div className="mb-6 flex items-center gap-3 text-sm font-light uppercase tracking-[0.24em] text-cyan-200/70">
              <Blocks className="h-4 w-4" />
              Why this architecture works
            </div>
            <h2 className="max-w-2xl text-3xl font-light tracking-tight text-white md:text-4xl">
              Privacy is an additive layer, not a wallet-stack replacement.
            </h2>
          </div>

          <div className="glass-panel rounded-[2rem] p-7 md:p-8" data-glow>
            <div className="mb-6 text-sm font-light uppercase tracking-[0.24em] text-emerald-200/70">
              System signals
            </div>
            <div className="space-y-4">
              {[
                { label: 'Stealth address export', value: 'Public view + spend keys' },
                { label: 'Auth model', value: 'Supabase session-backed access' },
                { label: 'Wallet backend', value: 'BitGo testnet + helpers' },
                { label: 'Detection strategy', value: 'Ephemeral metadata + output scan' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  data-glow
                >
                  <div className="text-sm text-white/45">{item.label}</div>
                  <div className="text-right text-sm font-light text-white/80">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <LandingPricing />
      <LandingShowcase />
      <LandingTestimonials />
      <LandingInsights />
      <LandingFaq />
      <LandingMotion />
      <LandingFooter />
    </main>
  );
}
