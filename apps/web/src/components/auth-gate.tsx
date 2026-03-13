'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export function AuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAuthStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      const next = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?next=${next}`);
    }
  }, [hydrated, pathname, router, token]);

  if (!hydrated || !token) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/70">
          Checking session…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
