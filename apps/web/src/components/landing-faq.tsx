'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

const faqItems = [
  {
    value: 'item-1',
    q: 'What privacy does stealth addressing improve?',
    a: 'It reduces deterministic address reuse and makes inbound payment linking significantly harder for external observers.',
  },
  {
    value: 'item-2',
    q: 'Do we replace BitGo wallet infrastructure?',
    a: 'No. Wallet operations remain on BitGo rails while stealth derivation and scanning are layered into the payment workflow.',
  },
  {
    value: 'item-3',
    q: 'Is this deployable as a product foundation?',
    a: 'Yes. The architecture uses typed APIs, auth boundaries, and modular scanner services designed for iterative production hardening.',
  },
] as const;

export function LandingFaq(): React.JSX.Element {
  return (
    <section id="faq" className="relative px-6 py-20 md:px-8" data-reveal>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-3 text-center" data-reveal>
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">FAQ</div>
          <h2 className="text-3xl font-light tracking-tight text-white md:text-5xl">
            Precise answers, no noise.
          </h2>
        </div>

        <Accordion.Root type="single" collapsible className="space-y-4" data-reveal>
          {faqItems.map((item) => (
            <Accordion.Item
              key={item.value}
              value={item.value}
              className="glass-panel overflow-hidden rounded-2xl"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between px-5 py-4 text-left text-sm font-light text-white md:text-base">
                  {item.q}
                  <ChevronDown className="h-4 w-4 text-white/55 transition duration-300 group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="accordion-content overflow-hidden px-5 pb-5 text-sm leading-7 text-white/60">
                {item.a}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
