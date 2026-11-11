'use client';

import Link from 'next/link';
import { useState } from 'react';
import DramaCard from '@/components/DramaCard';
import { demoById } from '@/lib/demo';
import { useStore } from '@/lib/store';
import type { Drama } from '@/lib/types';

function resolveSite(
  id: string,
  known: string | undefined,
  hasGateway: boolean,
): string {
  if (known) return known;
  if (demoById(id)) return 'demo';
  return hasGateway ? 'demo' : 'demo'; // 兜底；真实站点在收藏/播放时已记录
}

export default function LibraryPage() {
  const { favorites, history, hasGateway, siteOfFavorite, siteOfHistory, removeHistory, clearHistory, clearUserData } =
    useStore();
  const [tab, setTab] = useState<'fav' | 'hist'>('fav');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">我的</h1>
        <button
          className="text-sm text-ink-dim hover:text-red-400"
          onClick={() => {
            if (tab === 'hist') clearHistory();
            else clearUserData();
          }}
        >
          {tab === 'hist' ? '清空历史' : '清空全部本地数据'}
        </button>
      </div>

      <div className="flex gap-2">
        <button className={`chip ${tab === 'fav' ? 'chip-active' : ''}`} onClick={() => setTab('fav')}>
          收藏 ({favorites.length})
        </button>
        <button className={`chip ${tab === 'hist' ? 'chip-active' : ''}`} onClick={() => setTab('hist')}>
          历史 ({history.length})
        </button>
      </div>

      {tab === 'fav' ? (
        favorites.length === 0 ? (
          <Empty hint="还没有收藏，去片库里点亮 ❤ 吧" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {favorites.map((d: Drama) => (
              <DramaCard key={d.id} drama={d} site={resolveSite(d.id, siteOfFavorite(d.id), hasGateway)} />
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <Empty hint="还没有观看记录" />
      ) : (
        <div className="space-y-2">
          {history.map((h) => {
            const site = resolveSite(h.drama.id, siteOfHistory(h.drama.id), hasGateway);
            return (
              <div
                key={h.drama.id}
                className="card p-3 flex items-center gap-3 hover:border-accent transition-colors"
              >
                <Link
                  href={`/watch/${encodeURIComponent(site)}/${encodeURIComponent(h.drama.id)}/${h.episodeIndex}`}
                  className="flex-1 min-w-0"
                >
                  <div className="font-medium text-ink truncate">{h.drama.title}</div>
                  <div className="text-xs text-ink-dim truncate">
                    {h.episodeTitle} · {new Date(h.at).toLocaleString('zh-CN')}
                  </div>
                </Link>
                <button
                  onClick={() => removeHistory(h.drama.id)}
                  className="text-ink-dim hover:text-red-400 text-sm px-2"
                  aria-label="删除记录"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return <div className="card p-10 text-center text-ink-dim">{hint}</div>;
}
