'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, LogIn } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type LoginResponse = {
  data: {
    token: string;
    refreshToken: string;
    expiresAt: number;
    user: {
      id: string;
      email: string;
    };
  };
};

export default function LoginClientPage(): React.JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextUrl = useMemo(() => {
    const next = params.get('next');
    if (!next || !next.startsWith('/')) return '/dashboard';
    return next;
  }, [params]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', {
        email,
        password,
      });

      setAuth(
        {
          id: data.data.user.id,
          email: data.data.user.email,
        },
        data.data.token,
        data.data.refreshToken,
        data.data.expiresAt
      );

      router.replace(nextUrl);
    } catch {
      setError('Invalid email or password.');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-20 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute right-[12%] top-40 h-72 w-72 rounded-full bg-amber-500/10 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-black/50 p-7 backdrop-blur-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Secure access</p>
            <h1 className="text-2xl font-light tracking-tight">Sign in to Stealth Pay</h1>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-white/75">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-premium"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-white/75">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-premium"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="button-premium w-full disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-sm text-white/55">
          Need an account?{' '}
          <Link href="/" className="text-fuchsia-200 transition hover:text-fuchsia-100">
            Contact admin / use register API
          </Link>
        </p>
      </div>
    </main>
  );
}
