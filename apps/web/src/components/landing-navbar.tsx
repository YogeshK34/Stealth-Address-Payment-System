'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowUpRight, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '#features', label: 'Features' },
  { href: '#proof', label: 'Pricing' },
  { href: '/dashboard', label: 'View demo' },
  { href: '#faq', label: 'Blog' },
  { href: '#contact', label: 'Contact' },
];

export function LandingNavbar(): React.JSX.Element {
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(
      headerRef.current,
      { y: -24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }
    );
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 md:px-6 md:pt-6">
      <header
        ref={headerRef}
        className={cn(
          'pointer-events-auto w-full max-w-6xl rounded-full border border-white/12 bg-black/35 backdrop-blur-2xl transition-all duration-500',
          scrolled
            ? 'shadow-[0_20px_80px_rgba(0,0,0,0.55)] ring-1 ring-fuchsia-400/20'
            : 'shadow-[0_12px_60px_rgba(0,0,0,0.28)]'
        )}
      >
        <div className="flex h-14 items-center justify-between gap-4 px-5 md:h-[60px] md:px-7">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100 shadow-[0_0_30px_rgba(232,121,249,0.2)]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-light uppercase tracking-[0.24em] text-fuchsia-100/85">
                Stealth Pay
              </div>
              <div className="text-sm text-white/55">Private Bitcoin rails</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-light text-white/68 transition hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-400 via-rose-300 to-amber-200 px-4 py-2 text-sm font-light text-black shadow-[0_12px_40px_rgba(251,191,36,0.25)] transition hover:scale-[1.02]"
            >
              Sign in
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
