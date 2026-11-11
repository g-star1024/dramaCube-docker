'use client';

import { useEffect, useMemo, useState } from 'react';
import Player from '@/components/Player';
import { kDemoChannels } from '@/lib/demo';
import { getApi } from '@/lib/load';
import { useStore } from '@/lib/store';
import type { LiveChannel } from '@/lib/types';

export default function LivePage() {
  const { hasGateway, gateway } = useStore();
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState('全部');
  const [selected, setSelected] = useState<LiveChannel | null>(null);
  const [playerError, setPlayerError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!hasGateway) {
      setChannels(kDemoChannels.map((c) => ({ ...c })));
      setLoading(false);
      return;
    }
    setLoading(true);
    getApi(gateway)
      .liveChannels()
      .then((list) => {
        if (!alive) return;
        setChannels(list.length > 0 ? list : kDemoChannels.map((c) => ({ ...c })));
      })
      .catch(() => alive && setChannels(kDemoChannels.map((c) => ({ ...c }))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [hasGateway, gateway]);

  const groups = useMemo(() => {
    const set = new Set(channels.map((c) => c.group));
    return ['全部', ...Array.from(set)];
  }, [channels]);

  const shown = useMemo(
    () => (group === '全部' ? channels : channels.filter((c) => c.group === group)),
    [channels, group],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink">电视直播</h1>
        <p className="text-sm text-ink-dim mt-1">
          {hasGateway ? '来自网关直播源；失败时回退内置演示频道' : '内置演示频道（未配置网关）'}
        </p>
      </div>

      {selected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-ink font-medium truncate">{selected.name}</span>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>
              返回列表
            </button>
          </div>
          <Player
            key={selected.url}
            url={selected.url}
            title={selected.name}
            onError={(m) => setPlayerError(m)}
          />
          {playerError && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {playerError}
            </div>
          )}
        </div>
      ) : (
        <>
          {loading ? (
            <div className="text-ink-dim text-sm">加载中…</div>
          ) : shown.length === 0 ? (
            <div className="card p-10 text-center text-ink-dim">
              暂无直播频道。请在设置中配置网关（无网关时展示内置演示频道）。
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroup(g)}
                    className={`chip ${group === g ? 'chip-active' : ''}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {shown.map((c, i) => (
                  <button
                    key={`${c.name}-${i}`}
                    onClick={() => {
                      setPlayerError('');
                      setSelected(c);
                    }}
                    className="card p-4 text-left hover:border-accent transition-colors"
                  >
                    <div className="font-medium text-ink truncate">{c.name}</div>
                    <div className="text-xs text-ink-dim mt-1">{c.group}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
