'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useStore } from '@/lib/store';

interface NavEntry {
  key: string;
  label: string;
  href: string;
  icon: string; // 简单 SVG path / emoji 风格字符
}

const NAV: NavEntry[] = [
  { key: 'home', label: '首页', href: '/', icon: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { key: 'source', label: '片库', href: '/source', icon: 'M4 6h16M4 12h16M4 18h16' },
  { key: 'live', label: '直播', href: '/live', icon: 'M3 5h18v14H3zM10 9l5 3-5 3z' },
  { key: 'library', label: '我的', href: '/library', icon: 'M4 4h6v16H4zM14 4h6v16h-6z' },
  { key: 'settings', label: '设置', href: '/settings', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8z' },
];

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setNavIndex } = useStore();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="min-h-screen md:flex">
      {/* 桌面侧栏 */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-line bg-bg-soft sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">剧立方</span>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              onClick={() => setNavIndex(NAV.indexOf(n))}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive(n.href)
                  ? 'bg-accent/15 text-accent'
                  : 'text-ink-soft hover:bg-bg-hover hover:text-ink'
              }`}
            >
              <Icon d={n.icon} className="w-5 h-5" />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs text-ink-dim">DramaCube Web · 独立前端</div>
      </aside>

      {/* 主区 */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-shell px-4 sm:px-6 lg:px-8 py-5">{children}</div>
      </main>

      {/* 移动端底栏 */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-bg-soft/95 backdrop-blur border-t border-line flex">
        {NAV.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            onClick={() => setNavIndex(NAV.indexOf(n))}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] ${
              isActive(n.href) ? 'text-accent' : 'text-ink-dim'
            }`}
          >
            <Icon d={n.icon} className="w-5 h-5" />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
