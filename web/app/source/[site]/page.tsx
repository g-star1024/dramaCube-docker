'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DramaCard from '@/components/DramaCard';
import SearchBar from '@/components/SearchBar';
import { GridSkeleton } from '@/components/Skeleton';
import { kDemoCategories, kDemoItems } from '@/lib/demo';
import { getApi } from '@/lib/load';
import { useStore } from '@/lib/store';
import type { Drama } from '@/lib/types';

export default function SourceBrowsePage() {
  const params = useParams<{ site: string }>();
  const site = decodeURIComponent(params.site as string);
  const { gateway, hasGateway } = useStore();

  const isDemo = site === 'demo';

  // —— 演示分类筛选 ——
  const [category, setCategory] = useState('全部');
  const demoList = useMemo(() => {
    if (!isDemo) return [];
    const list = kDemoItems.map((d) => d.drama);
    if (category === '全部') return list;
    return list.filter((_, i) => kDemoItems[i].category === category);
  }, [isDemo, category]);

  // —— 网关分页/搜索 ——
  const [items, setItems] = useState<Drama[]>([]);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isDemo || !hasGateway) return;
    let alive = true;
    setLoading(true);
    setError('');
    getApi(gateway)
      .list({ site, page, keyword })
      .then((list) => {
        if (!alive) return;
        // 第一页覆盖，后续页追加。
        setItems((prev) => (page === 1 ? list : [...prev, ...list]));
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [isDemo, hasGateway, gateway, site, page, keyword]);

  // 网关搜索通过 SearchBar 的 onSubmit 本地处理（见下方渲染）。

  if (isDemo) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Link href="/source" className="text-ink-dim hover:text-ink">
            ← 片库
          </Link>
        </div>
        <h1 className="text-xl font-bold text-ink">演示片库</h1>
        <div className="flex flex-wrap gap-2">
          {kDemoCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`chip ${category === c ? 'chip-active' : ''}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {demoList.map((d) => (
            <DramaCard key={d.id} drama={d} site="demo" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasGateway) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ink-soft mb-3">该视频源需要网关支持，请先在设置中配置网关地址。</p>
        <Link href="/settings" className="btn btn-accent">
          去设置
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/source" className="text-ink-dim hover:text-ink">
          ← 片库
        </Link>
        <h1 className="text-xl font-bold text-ink truncate">{site}</h1>
      </div>

      <SearchBar
        placeholder="在当前视频源内搜索…"
        defaultValue={keyword}
        onSubmit={(w) => {
          setPage(1);
          setKeyword(w);
        }}
      />

      {error && <div className="text-red-400 text-sm">加载失败：{error}</div>}

      {loading && page === 1 ? (
        <GridSkeleton />
      ) : items.length === 0 ? (
        <div className="text-ink-dim text-sm py-10 text-center">
          {keyword ? '没有找到相关结果' : '该源暂无内容或暂不支持列表浏览'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((d) => (
              <DramaCard key={d.id} drama={d} site={site} />
            ))}
          </div>
          <div className="flex justify-center pt-2">
            <button
              className="btn btn-ghost"
              disabled={loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {loading ? '加载中…' : '加载更多'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
