'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import EpisodeList from '@/components/EpisodeList';
import { accentOf } from '@/lib/accent';
import { accentFor, demoById } from '@/lib/demo';
import { loadDetail } from '@/lib/load';
import { useStore } from '@/lib/store';
import type { DramaDetail, Episode } from '@/lib/types';

export default function FilmDetailPage() {
  const params = useParams<{ site: string; id: string }>();
  const router = useRouter();
  const site = decodeURIComponent(params.site as string);
  const id = decodeURIComponent(params.id as string);
  const { gateway, hasGateway, isFavorite, toggleFavorite, addHistory } = useStore();

  const [detail, setDetail] = useState<DramaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    loadDetail(site, id, gateway)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [site, id, gateway]);

  if (loading) {
    return <div className="text-ink-dim text-sm py-10">加载中…</div>;
  }
  if (error || !detail) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ink-soft mb-2">无法加载详情</p>
        <p className="text-ink-dim text-sm">{error || '未找到该内容'}</p>
        <Link href="/" className="btn btn-ghost mt-4">
          返回首页
        </Link>
      </div>
    );
  }

  const { drama, episodes } = detail;
  const seed = accentFor(drama.id);
  const acc = accentOf(seed);
  const fav = isFavorite(drama.id);
  const isDemoItem = site === 'demo';

  const play = (ep: Episode) => {
    addHistory(drama, ep.index, ep.title, ep.playURL ?? '');
    // 跳转交给 Link；此处仅记录历史
  };

  return (
    <div className="space-y-6">
      <Link href={isDemoItem ? '/source/demo' : `/source/${encodeURIComponent(site)}`} className="text-ink-dim hover:text-ink">
        ← 返回
      </Link>

      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        {/* 海报 */}
        <div
          className="relative rounded-xl2 overflow-hidden aspect-[2/3] w-full max-w-[260px]"
          style={{ background: `linear-gradient(135deg, ${acc.from}, ${acc.to})` }}
        >
          {drama.coverURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={drama.coverURL} alt={drama.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <span className="text-center font-bold" style={{ color: acc.text }}>
                {drama.title}
              </span>
            </div>
          )}
        </div>

        {/* 信息 */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">{drama.title}</h1>
            {drama.remark && <p className="text-ink-dim mt-1 text-sm">{drama.remark}</p>}
          </div>

          {isDemoItem && (
            <p className="text-ink-soft leading-relaxed">
              {demoById(drama.id)?.summary}
            </p>
          )}

          <div className="flex gap-3">
            <Link
              href={`/watch/${encodeURIComponent(site)}/${encodeURIComponent(drama.id)}/0`}
              className="btn btn-accent"
            >
              立即播放
            </Link>
            <button onClick={() => toggleFavorite(drama, site)} className="btn btn-ghost">
              {fav ? '已收藏' : '收藏'}
            </button>
          </div>
        </div>
      </div>

      {/* 选集 */}
      {episodes.length > 0 ? (
        <EpisodeList
          episodes={episodes}
          current={-1}
          onSelect={(ep) => {
            play(ep);
            router.push(
              `/watch/${encodeURIComponent(site)}/${encodeURIComponent(drama.id)}/${ep.index}`,
            );
          }}
        />
      ) : (
        <div className="text-ink-dim text-sm">该内容暂无可用分集（可能是播放地址解析失败）。</div>
      )}
    </div>
  );
}
