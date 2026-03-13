import { Suspense } from 'react';
import LoginClientPage from './login-client';

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6 py-20 text-white">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/70">
            Loading login…
          </div>
        </main>
      }
    >
      <LoginClientPage />
    </Suspense>
  );
}
