'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { getApi } from '@/lib/load';

export default function SettingsPage() {
  const {
    gateway,
    setGateway,
    searches,
    clearSearches,
    clearUserData,
  } = useStore();

  const [draft, setDraft] = useState(gateway);
  const [health, setHealth] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [saved, setSaved] = useState(false);

  const save = () => {
    setGateway(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const check = async () => {
    if (!draft.trim()) return;
    setHealth('checking');
    const ok = await getApi(draft).health();
    setHealth(ok ? 'ok' : 'fail');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-ink">设置</h1>

      {/* 网关 */}
      <section className="card p-5 space-y-3">
        <h2 className="font-semibold text-ink">网关地址</h2>
        <p className="text-xs text-ink-dim">
          留空则走同源 <code className="text-ink-soft">/api</code> 反代（由部署环境的 GATEWAY_URL 决定）。
          填入后将以该地址直连（需网关开启 CORS）。
        </p>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="http://192.168.1.10:8787"
            className="flex-1 bg-bg-soft border border-line rounded-lg px-3 py-2 text-ink outline-none focus:border-accent"
          />
          <button className="btn btn-accent" onClick={save}>
            保存
          </button>
          <button className="btn btn-ghost" onClick={check} disabled={health === 'checking'}>
            {health === 'checking' ? '检测中' : '连通检测'}
          </button>
        </div>
        {health === 'ok' && <p className="text-green-400 text-sm">✓ 网关连通正常</p>}
        {health === 'fail' && (
          <p className="text-red-400 text-sm">✗ 无法连通（地址或 CORS 有误）</p>
        )}
        {saved && <p className="text-green-400 text-sm">已保存</p>}
      </section>

      {/* 搜索历史 */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">搜索历史</h2>
          {searches.length > 0 && (
            <button className="text-sm text-ink-dim hover:text-red-400" onClick={clearSearches}>
              清空
            </button>
          )}
        </div>
        {searches.length === 0 ? (
          <p className="text-xs text-ink-dim">暂无搜索记录</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {searches.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 数据管理 */}
      <section className="card p-5 space-y-3">
        <h2 className="font-semibold text-ink">本地数据</h2>
        <p className="text-xs text-ink-dim">收藏、历史与搜索均保存在本机浏览器，可一键清除。</p>
        <button className="btn btn-ghost border-red-500/40 text-red-300" onClick={clearUserData}>
          清空全部本地数据
        </button>
      </section>

      <p className="text-xs text-ink-dim">
        DramaCube Web · 独立 Next.js 前端（与 Flutter 桌面/移动端共享网关，互不修改其源码）
      </p>
    </div>
  );
}
