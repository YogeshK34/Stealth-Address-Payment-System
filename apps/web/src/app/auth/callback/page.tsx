'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuthStore } from '@/store/auth';

export default function AuthCallbackPage(): React.JSX.Element {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setAuth(
          {
            id: session.user.id,
            email: session.user.email ?? '',
          },
          session.access_token,
          session.refresh_token,
          session.expires_at ?? Math.floor(Date.now() / 1000) + 3600
        );

        router.replace('/dashboard');
      }
    });

    // Supabase automatically picks up tokens from the URL hash on this page.
    // If there's no hash or it fails, show an error after a timeout.
    const timeout = setTimeout(() => {
      setError('Authentication timed out. Please try again.');
    }, 10000);

    return () => clearTimeout(timeout);
  }, [router, setAuth]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-20 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-black/50 p-7 text-center backdrop-blur-2xl">
          <p className="text-rose-300">{error}</p>
          <button onClick={() => router.replace('/login')} className="button-premium mt-4 w-full">
            Back to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-20 text-white">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-fuchsia-400/30 border-t-fuchsia-400" />
        <p className="text-sm text-white/55">Completing sign in...</p>
      </div>
    </main>
  );
}
