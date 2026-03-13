import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from '@/components/providers';

const generalSans = localFont({
  src: [
    { path: '../../public/fonts/GeneralSans-Regular.otf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/GeneralSans-Medium.otf', weight: '500', style: 'normal' },
    { path: '../../public/fonts/GeneralSans-Semibold.otf', weight: '600', style: 'normal' },
    { path: '../../public/fonts/GeneralSans-Bold.otf', weight: '700', style: 'normal' },
    { path: '../../public/fonts/GeneralSans-Italic.otf', weight: '400', style: 'italic' },
    { path: '../../public/fonts/GeneralSans-MediumItalic.otf', weight: '500', style: 'italic' },
    { path: '../../public/fonts/GeneralSans-SemiboldItalic.otf', weight: '600', style: 'italic' },
  ],
  variable: '--font-general-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Stealth Pay — Private Bitcoin Payments',
  description:
    'Send and receive Bitcoin privately using cryptographic stealth addresses powered by BitGo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={generalSans.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
