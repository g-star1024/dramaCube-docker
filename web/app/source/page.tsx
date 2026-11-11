'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getApi } from '@/lib/load';
import type { TVBoxSite } from '@/lib/types';

export default function SourcePage() {
  const { hasGateway, gateway } = useStore();
  const [sites, setSites] = useState<TVBoxSite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasGateway) return;
    let alive = true;
    setLoading(true);
    getApi(gateway)
      .sites()
      .then((s) => alive && setSites(s))
      .catch(() => alive && setSites([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [hasGateway, gateway]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-ink">片库</h1>
        <p className="text-sm text-ink-dim mt-1">选择视频源开始浏览</p>
      </div>

      {/* 演示片库（内置，无需网关） */}
      <section>
        <h2 className="text-base font-semibold text-ink-soft mb-3">内置演示</h2>
        <Link
          href="/source/demo"
          className="card p-5 flex items-center justify-between hover:border-accent transition-colors"
        >
          <div>
            <div className="font-medium text-ink">演示片库</div>
            <div className="text-xs text-ink-dim mt-1">9 部内置测试片，离线/在线混合</div>
          </div>
          <span className="text-accent">→</span>
        </Link>
      </section>

      {/* 网关视频源 */}
      {hasGateway && (
        <section>
          <h2 className="text-base font-semibold text-ink-soft mb-3">视频源（网关）</h2>
          {loading ? (
            <div className="text-ink-dim text-sm">加载中…</div>
          ) : sites.length === 0 ? (
            <div className="text-ink-dim text-sm">未获取到站点，请检查网关地址或订阅源。</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sites.map((s) => (
                <Link
                  key={s.key}
                  href={`/source/${encodeURIComponent(s.key)}`}
                  className="card p-4 hover:border-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-ink truncate">{s.name}</div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded ${
                        s.tag === 'Adult'
                          ? 'bg-pink-500/20 text-pink-300'
                          : 'bg-bg-hover text-ink-dim'
                      }`}
                    >
                      {s.tag === 'Adult' ? '成人' : '普通'}
                    </span>
                  </div>
                  <div className="text-xs text-ink-dim mt-1">{s.key}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {!hasGateway && (
        <section className="card p-8 text-center">
          <p className="text-ink-soft mb-3">未配置网关，仅可浏览内置演示片库。</p>
          <Link href="/settings" className="btn btn-accent">
            配置网关
          </Link>
        </section>
      )}
    </div>
  );
}
