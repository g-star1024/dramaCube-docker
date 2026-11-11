'use client';

import type { Episode } from '@/lib/types';

export default function EpisodeList({
  episodes,
  current,
  onSelect,
}: {
  episodes: Episode[];
  current: number;
  onSelect: (ep: Episode) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-soft">
          选集 <span className="text-ink-dim">({episodes.length})</span>
        </h3>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {episodes.map((ep) => (
          <button
            key={ep.id}
            onClick={() => onSelect(ep)}
            className={`px-3 py-2 rounded-lg text-sm border text-left truncate transition-colors ${
              ep.index === current
                ? 'bg-accent text-white border-accent'
                : 'bg-bg-soft text-ink-soft border-line hover:bg-bg-hover hover:text-ink'
            }`}
            title={ep.title}
          >
            {ep.title}
          </button>
        ))}
      </div>
    </div>
  );
}
