'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { Activity, ArrowUpRight, LogOut, Radar, Shield, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Wallet },
  { href: '/receive', label: 'Receive', icon: Shield },
  { href: '/send', label: 'Send', icon: ArrowUpRight },
  { href: '/scan', label: 'Scan', icon: Radar },
];

export function NavBar(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(
      headerRef.current,
      { y: -24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }
    );
  }, []);

  const onSignOut = (): void => {
    clearAuth();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('stealth_token');
    }
    router.replace('/login');
  };

  return (
    <div className="sticky top-0 z-40 px-4 pt-4 md:px-6">
      <header
        ref={headerRef}
        className="app-shell-panel mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-3 md:px-6"
      >
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-light uppercase tracking-[0.22em] text-fuchsia-100/85">
              Stealth Pay
            </div>
            <div className="text-xs text-white/45">Internal operations</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) =>
            (() => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-light transition-colors',
                    pathname === item.href
                      ? 'bg-white/12 text-white shadow-[0_8px_24px_rgba(15,23,42,0.26)]'
                      : 'text-white/58 hover:bg-white/7 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })()
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-xs font-light text-emerald-200 md:flex">
            <Activity className="h-3.5 w-3.5" />
            Scanner online
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-2 text-xs font-light text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>
    </div>
  );
}
