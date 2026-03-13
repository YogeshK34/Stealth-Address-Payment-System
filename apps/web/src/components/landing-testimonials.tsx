import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote:
      'The stealth-address layer gave us a cleaner privacy story without replacing our existing wallet operations.',
    author: 'Head of Payments, Fintech Team',
  },
  {
    quote:
      'The dashboard feels premium and focused. It communicates technical trust in the first minute.',
    author: 'Product Lead, Crypto Infrastructure',
  },
  {
    quote:
      'We loved the scanner-first architecture. Fast detection, clear state, low operational friction.',
    author: 'Engineering Manager, Treasury Ops',
  },
] as const;

export function LandingTestimonials(): React.JSX.Element {
  return (
    <section id="testimonials" className="relative px-6 py-20 md:px-8" data-reveal>
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl space-y-4" data-reveal>
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Testimonials</div>
          <h2 className="text-3xl font-light tracking-tight text-white md:text-5xl">
            Built to feel credible from first interaction.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3" data-reveal>
          {testimonials.map((item) => (
            <article key={item.author} className="glass-panel rounded-[1.7rem] p-6">
              <Quote className="h-5 w-5 text-fuchsia-200" />
              <p className="mt-4 text-sm leading-7 text-white/75">{item.quote}</p>
              <div className="mt-5 text-xs uppercase tracking-[0.2em] text-white/45">
                {item.author}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
