import type { Metadata } from 'next';
import { Manrope, Fraunces } from 'next/font/google';
import { GlobalActionToast } from '@/components/layout/global-action-toast';
import './globals.css';

const manrope = Manrope({ subsets: ['latin', 'vietnamese'], variable: '--font-manrope' });
const fraunces = Fraunces({ subsets: ['latin', 'vietnamese'], variable: '--font-fraunces' });

export const metadata: Metadata = {
  title: 'Kumon Management',
  description: 'Hệ thống quản lý trung tâm Kumon',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/images/logo_kumon.png', type: 'image/png' },
    ],
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${manrope.variable} ${fraunces.variable}`}>
      <body>
        <GlobalActionToast />
        {children}
      </body>
    </html>
  );
}
