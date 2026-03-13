import { NavBar } from '@/components/nav-bar';
import { AuthGate } from '@/components/auth-gate';

export default function AppLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-20 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-amber-500/10 blur-[150px]" />
      </div>
      <NavBar />
      <main className="relative z-10 mx-auto flex-1 w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <AuthGate>{children}</AuthGate>
      </main>
    </div>
  );
}
