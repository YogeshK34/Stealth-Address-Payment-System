'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function LoginClientPage(): React.JSX.Element {
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setGooglePending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setGooglePending(false);
      }
    } catch {
      setError('Failed to start Google sign-in.');
      setGooglePending(false);
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

        {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

        <button
          type="button"
          disabled={googlePending}
          onClick={handleGoogleLogin}
          className="button-premium flex w-full items-center justify-center gap-2 disabled:opacity-60"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {googlePending ? 'Redirecting…' : 'Sign in with Google'}
        </button>

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
