'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SearchBar from '@/components/SearchBar';
import DramaCard from '@/components/DramaCard';
import { kDemoItems } from '@/lib/demo';
import { accentOf } from '@/lib/accent';
import { accentFor } from '@/lib/demo';
import { useStore } from '@/lib/store';
import { getApi } from '@/lib/load';
import type { TVBoxSite } from '@/lib/types';

export default function HomePage() {
  const { hasGateway, gateway } = useStore();
  const [sites, setSites] = useState<TVBoxSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);

  useEffect(() => {
    if (!hasGateway) {
      setSites([]);
      return;
    }
    let alive = true;
    setSitesLoading(true);
    getApi(gateway)
      .sites()
      .then((s) => alive && setSites(s))
      .catch(() => alive && setSites([]))
      .finally(() => alive && setSitesLoading(false));
    return () => {
      alive = false;
    };
  }, [hasGateway, gateway]);

  const featured = kDemoItems[0];

  return (
    <div className="space-y-8">
      <section>
        <SearchBar />
      </section>

      {/* 连上真实网关：演示数据自动让位，真实片库登上主页主位 */}
      {hasGateway && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink">视频源</h2>
            <Link href="/source" className="text-sm text-accent hover:underline">
              全部 →
            </Link>
          </div>
          {sitesLoading ? (
            <div className="text-ink-dim text-sm">加载中…</div>
          ) : sites.length === 0 ? (
            <div className="text-ink-dim text-sm">未获取到站点，请检查网关地址或订阅源。</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sites.map((s) => (
                <Link
                  key={s.key}
                  href={`/source/${encodeURIComponent(s.key)}`}
                  className="card p-4 hover:border-accent transition-colors"
                >
                  <div className="font-medium text-ink truncate">{s.name}</div>
                  <div className="text-xs text-ink-dim mt-1">
                    {s.tag === 'Adult' ? '成人' : '普通'} · {s.key}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 内置演示片库：常驻。无网关时为主角（含 Hero 大卡），有网关时降为次要区块 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">
            {hasGateway ? '内置演示' : '演示片库'}
          </h2>
          <Link href="/source/demo" className="text-sm text-accent hover:underline">
            浏览全部 →
          </Link>
        </div>

        {!hasGateway && featured && (
          <div className="card overflow-hidden grid md:grid-cols-[300px_1fr] gap-0 mb-6">
            <div
              className="relative min-h-[360px] md:min-h-full"
              style={{
                background: `linear-gradient(135deg, ${accentOf(featured.accent).from}, ${accentOf(featured.accent).to})`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <span className="text-white text-2xl font-bold text-center leading-snug">
                  {featured.drama.title}
                </span>
              </div>
            </div>
            <div className="p-6 flex flex-col justify-center gap-4">
              <div className="flex items-center gap-2">
                <span className="chip chip-active">演示</span>
                <span className="text-sm text-ink-dim">{featured.drama.remark}</span>
              </div>
              <h1 className="text-2xl font-bold text-ink">{featured.drama.title}</h1>
              <p className="text-ink-soft leading-relaxed">{featured.summary}</p>
              <div className="flex gap-3 mt-2">
                <Link
                  href={`/watch/demo/${featured.drama.id}/0`}
                  className="btn btn-accent"
                >
                  立即播放
                </Link>
                <Link
                  href={`/film/demo/${featured.drama.id}`}
                  className="btn btn-ghost"
                >
                  查看详情
                </Link>
              </div>
            </div>
          </div>
        )}

        <div
          className={`grid gap-4 ${
            hasGateway
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          }`}
        >
          {kDemoItems.map((d) => (
            <DramaCard key={d.drama.id} drama={d.drama} site="demo" />
          ))}
        </div>
      </section>

      {/* 无网关提示 */}
      {!hasGateway && (
        <section className="card p-6 text-sm text-ink-soft">
          当前未配置网关，展示的是内置演示片库（离线可播）。前往
          <Link href="/settings" className="text-accent hover:underline mx-1">
            设置
          </Link>
          配置网关后，真实片库将自动登上主页、演示片库降为内置补充。
        </section>
      )}
    </div>
  );
}
