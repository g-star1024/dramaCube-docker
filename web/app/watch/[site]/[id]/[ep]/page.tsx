'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Player from '@/components/Player';
import EpisodeList from '@/components/EpisodeList';
import { loadDetail } from '@/lib/load';
import { useStore } from '@/lib/store';
import type { DramaDetail } from '@/lib/types';

export default function WatchPage() {
  const params = useParams<{ site: string; id: string; ep: string }>();
  const router = useRouter();
  const site = decodeURIComponent(params.site as string);
  const id = decodeURIComponent(params.id as string);
  const epIndex = Number(params.ep) || 0;
  const { gateway, addHistory } = useStore();

  const [detail, setDetail] = useState<DramaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerError, setPlayerError] = useState('');

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

  const current = detail?.episodes[epIndex] ?? detail?.episodes[0] ?? null;

  // 写入播放历史（每次切集/加载）。
  useEffect(() => {
    if (detail && current) {
      addHistory(detail.drama, current.index, current.title, current.playURL ?? '', site);
    }
  }, [detail, current, addHistory]);

  if (loading) {
    return <div className="text-ink-dim text-sm py-10">加载中…</div>;
  }
  if (error || !detail) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ink-soft mb-2">无法加载播放信息</p>
        <p className="text-ink-dim text-sm">{error || '未找到该内容'}</p>
        <Link href="/" className="btn btn-ghost mt-4">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/film/${encodeURIComponent(site)}/${encodeURIComponent(id)}`}
          className="text-ink-dim hover:text-ink text-sm"
        >
          ← {detail.drama.title}
        </Link>
        <span className="text-sm text-ink-soft truncate">{current?.title}</span>
      </div>

      {current?.playURL ? (
        <Player
          key={current.playURL}
          url={current.playURL}
          title={`${detail.drama.title} · ${current.title}`}
          poster={detail.drama.coverURL ?? undefined}
          onError={(m) => setPlayerError(m)}
        />
      ) : (
        <div className="w-full aspect-video bg-bg-card rounded-xl2 grid place-items-center text-ink-dim">
          该分集没有可用的播放地址
        </div>
      )}

      {playerError && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {playerError}
        </div>
      )}

      {detail.episodes.length > 0 && (
        <EpisodeList
          episodes={detail.episodes}
          current={current?.index ?? -1}
          onSelect={(ep) =>
            router.push(
              `/watch/${encodeURIComponent(site)}/${encodeURIComponent(id)}/${ep.index}`,
            )
          }
        />
      )}
    </div>
  );
}
