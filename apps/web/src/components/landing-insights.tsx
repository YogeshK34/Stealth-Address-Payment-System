import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const posts = [
  {
    title: 'Stealth addresses for modern payment UX',
    tag: 'Architecture',
    href: '#',
  },
  {
    title: 'Designing scanner-first operational flows',
    tag: 'Engineering',
    href: '#',
  },
  {
    title: 'Privacy-forward product narratives that convert',
    tag: 'Product',
    href: '#',
  },
] as const;

export function LandingInsights(): React.JSX.Element {
  return (
    <section id="insights" className="relative px-6 py-20 md:px-8" data-reveal>
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl space-y-4" data-reveal>
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Blog</div>
          <h2 className="text-3xl font-light tracking-tight text-white md:text-5xl">
            Insights for private payment systems.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3" data-reveal>
          {posts.map((post) => (
            <article key={post.title} className="glass-panel rounded-[1.7rem] p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-100/70">
                {post.tag}
              </div>
              <h3 className="mt-3 text-xl font-light text-white">{post.title}</h3>
              <Link
                href={post.href}
                className="mt-6 inline-flex items-center gap-2 text-sm text-cyan-100 transition hover:text-white"
              >
                Read article
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
