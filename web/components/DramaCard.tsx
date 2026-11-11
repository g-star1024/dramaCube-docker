'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Drama } from '@/lib/types';
import { useStore } from '@/lib/store';
import { accentFor } from '@/lib/demo';
import { accentOf } from '@/lib/accent';

function Poster({ drama, accentSeed }: { drama: Drama; accentSeed: number }) {
  const acc = accentOf(accentSeed);
  const [failed, setFailed] = useState(false);
  const showImg = drama.coverURL && !failed;
  return (
    <div
      className="relative w-full aspect-[2/3] overflow-hidden"
      style={showImg ? undefined : { background: `linear-gradient(135deg, ${acc.from}, ${acc.to})` }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={drama.coverURL as string}
          alt={drama.title}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <span
            className="text-center font-semibold leading-tight line-clamp-3"
            style={{ color: acc.text }}
          >
            {drama.title}
          </span>
        </div>
      )}
      {drama.remark ? (
        <span className="absolute left-2 bottom-2 text-[11px] px-2 py-0.5 rounded bg-black/55 text-white backdrop-blur">
          {drama.remark}
        </span>
      ) : null}
    </div>
  );
}

export default function DramaCard({ drama, site }: { drama: Drama; site: string }) {
  const { isFavorite, toggleFavorite } = useStore();
  const fav = isFavorite(drama.id);
  const seed = accentFor(drama.id);

  return (
    <Link href={`/film/${site}/${encodeURIComponent(drama.id)}`} className="group block">
      <div className="card overflow-hidden transition-transform group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-black/40">
        <div className="relative">
          <Poster drama={drama} accentSeed={seed} />
          <button
            aria-label={fav ? '取消收藏' : '收藏'}
            onClick={(e) => {
              e.preventDefault();
              toggleFavorite(drama);
            }}
            className="absolute right-2 top-2 w-8 h-8 rounded-full bg-black/55 backdrop-blur flex items-center justify-center text-white hover:bg-black/75 transition"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill={fav ? '#e8743b' : 'none'} stroke="currentColor" strokeWidth={1.8}>
              <path d="M12 21s-7-4.5-9.5-9A5 5 0 0112 5a5 5 0 019.5 7c-2.5 4.5-9.5 9-9.5 9z" />
            </svg>
          </button>
        </div>
        <div className="p-3">
          <div className="text-sm font-medium text-ink truncate">{drama.title}</div>
          <div className="text-xs text-ink-dim mt-1 truncate">{drama.remark || ' '}</div>
        </div>
      </div>
    </Link>
  );
}
