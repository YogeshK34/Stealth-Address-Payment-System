import Link from 'next/link';
import { ArrowUpRight, BadgeCheck, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$0',
    subtitle: 'For product demos',
    features: ['Stealth address generation', 'Basic scan monitoring', 'Dashboard + auth'],
    cta: 'Get started',
    href: '/login',
    featured: false,
  },
  {
    name: 'Scale',
    price: '$99',
    subtitle: 'Per month · team tier',
    features: ['Priority scanner queue', 'Advanced policy controls', 'Ops-level observability'],
    cta: 'Choose Scale',
    href: '/login',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    subtitle: 'For regulated teams',
    features: ['Dedicated infrastructure', 'Security onboarding', 'Compliance workflows'],
    cta: 'Contact sales',
    href: '#contact',
    featured: false,
  },
] as const;

export function LandingPricing(): React.JSX.Element {
  return (
    <section id="pricing" className="relative px-6 py-20 md:px-8" data-reveal>
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-3xl space-y-4" data-reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-fuchsia-100/85">
            <Sparkles className="h-3.5 w-3.5" />
            Pricing
          </div>
          <h2 className="text-3xl font-light tracking-tight text-white md:text-5xl">
            Clear pricing for private Bitcoin payment infrastructure.
          </h2>
          <p className="text-sm leading-7 text-white/55 md:text-base">
            Start free, scale with premium operations, then move to enterprise controls.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3" data-reveal>
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={[
                'glass-panel rounded-[1.75rem] p-6 transition duration-300 hover:-translate-y-1',
                plan.featured
                  ? 'border-fuchsia-300/25 bg-gradient-to-b from-fuchsia-400/12 to-white/5 shadow-[0_26px_80px_rgba(232,121,249,0.18)]'
                  : 'border-white/10 bg-white/[0.04]',
              ].join(' ')}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xl font-light text-white">{plan.name}</div>
                {plan.featured ? (
                  <div className="rounded-full border border-fuchsia-300/30 bg-fuchsia-400/15 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-fuchsia-100">
                    Popular
                  </div>
                ) : null}
              </div>

              <div className="text-3xl font-light text-white">{plan.price}</div>
              <div className="mt-2 text-sm text-white/55">{plan.subtitle}</div>

              <ul className="mt-6 space-y-3 text-sm text-white/72">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-cyan-200" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={[
                  'mt-7 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition',
                  plan.featured
                    ? 'bg-gradient-to-r from-fuchsia-400 via-rose-300 to-amber-200 text-black'
                    : 'border border-white/12 bg-white/5 text-white/88 hover:border-white/20',
                ].join(' ')}
              >
                {plan.cta}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
