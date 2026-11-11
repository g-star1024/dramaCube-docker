'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DramaCard from '@/components/DramaCard';
import { GridSkeleton } from '@/components/Skeleton';
import { kDemoItems } from '@/lib/demo';
import { getApi } from '@/lib/load';
import { useStore } from '@/lib/store';
import type { Drama, TVBoxSite } from '@/lib/types';

interface SearchHit {
  drama: Drama;
  site: string;
}

function SearchInner() {
  const params = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const { hasGateway, gateway, addSearch } = useStore();

  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!q) {
      setResults([]);
      setDone(false);
      return;
    }
    let alive = true;
    addSearch(q);
    setLoading(true);
    setDone(false);

    const hits: SearchHit[] = kDemoItems
      .map((d) => d.drama)
      .filter((d) => d.title.toLowerCase().includes(q.toLowerCase()))
      .map((drama) => ({ drama, site: 'demo' }));

    const run = async () => {
      if (hasGateway) {
        try {
          const sites: TVBoxSite[] = await getApi(gateway).sites();
          const perSite = await Promise.all(
            sites.map((s) =>
              getApi(gateway)
                .list({ site: s.key, keyword: q })
                .then((list) => list.map((drama) => ({ drama, site: s.key })))
                .catch(() => [] as SearchHit[]),
            ),
          );
          for (const arr of perSite) hits.push(...arr);
        } catch {
          /* ignore */
        }
      }
      if (!alive) return;
      // 去重（同 id+title 保留首个）。
      const seen = new Set<string>();
      const merged = hits.filter((h) => {
        const key = `${h.drama.id}:${h.drama.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setResults(merged);
      setLoading(false);
      setDone(true);
    };
    run();
    return () => {
      alive = false;
    };
  }, [q, hasGateway, gateway, addSearch]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink">
          搜索：<span className="text-accent">{q}</span>
        </h1>
        <p className="text-sm text-ink-dim mt-1">
          {done && `共 ${results.length} 条结果（演示 + 网关多源聚合）`}
        </p>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : results.length === 0 ? (
        <div className="card p-10 text-center text-ink-dim">
          没有找到与「{q}」相关的内容
          {!hasGateway && <div className="text-xs mt-2">提示：配置网关后可搜索真实片库</div>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((h, i) => (
            <DramaCard key={`${h.site}:${h.drama.id}-${i}`} drama={h.drama} site={h.site} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-ink-dim text-sm">加载中…</div>}>
      <SearchInner />
    </Suspense>
  );
}
