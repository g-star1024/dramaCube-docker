import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'DramaCube 剧立方',
  description: 'DramaCube 独立 Web 前端：点播、直播、收藏与续播',
  applicationName: 'DramaCube',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'DramaCube' },
};

export const viewport: Viewport = {
  themeColor: '#0f0d0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
