// 网关 API 客户端（移植自 Flutter web_api.dart 的 WebGatewayApi）。
//
// 两种连接模式（与 Flutter _endpoint 对齐）：
//  1. 未设置自定义网关 → 同源 /api/* 由 Next.js 反代到 GATEWAY_URL（生产部署首选，无 CORS/混合内容问题）。
//  2. 用户在设置页设置网关地址 → 直连该地址（依赖网关 Access-Control-Allow-Origin:*）。
//
// 全部使用 fetch，仅依赖浏览器原生能力，不引入额外网络库。

import type { Drama, DramaDetail, Episode, LiveChannel, TVBoxSite } from './types';
import { parsePlayUrl } from './parse';

export class WebGatewayApi {
  /** gateway 为空表示走同源反代。 */
  constructor(public gateway?: string) {}

  private endpoint(path: string): string {
    const base = (this.gateway ?? '').trim();
    if (!base || base === '/' || base === '.') return path;
    return `${base.replace(/\/+$/, '')}${path}`;
  }

  private async get(path: string, query: Record<string, string | number>): Promise<unknown> {
    const url = new URL(this.endpoint(path), window.location.origin);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
    const resp = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  async health(): Promise<boolean> {
    try {
      const data = (await this.get('/api/health', {})) as { ok?: boolean };
      return data?.ok === true;
    } catch {
      return false;
    }
  }

  async sites(): Promise<TVBoxSite[]> {
    const data = (await this.get('/api/tvbox/sites', {})) as unknown[];
    if (!Array.isArray(data)) return [];
    return data
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map((e): TVBoxSite => ({
        key: String(e['key'] ?? ''),
        name: String(e['name'] ?? ''),
        api: String(e['api'] ?? ''),
        tag: e['tag'] === 'Adult' ? 'Adult' : 'Ordinary',
      }))
      .filter((s) => s.key.length > 0);
  }

  async importSubscription(url: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const data = (await this.get('/api/tvbox/import', { url })) as Record<string, unknown>;
      return data && data['ok'] === true
        ? { ok: true }
        : { ok: false, error: String(data?.['error'] ?? '响应格式异常') };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  async list(opts: {
    site: string;
    page?: number;
    keyword?: string;
    typeId?: string;
  }): Promise<Drama[]> {
    const { site, page = 1, keyword, typeId } = opts;
    let path: string;
    const query: Record<string, string | number> = { site };
    if (keyword && keyword.trim()) {
      path = '/api/tvbox/search';
      query['wd'] = keyword.trim();
    } else {
      path = '/api/tvbox/list';
      query['pg'] = page;
      if (typeId && typeId.length) query['t'] = typeId;
    }
    const data = (await this.get(path, query)) as unknown[];
    if (!Array.isArray(data)) return [];
    return data
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map((m) => dramaFromTvbox(m))
      .filter((d) => d.title.length > 0);
  }

  async detail(site: string, drama: Drama): Promise<DramaDetail> {
    const data = (await this.get('/api/tvbox/detail', { site, id: drama.id })) as Record<
      string,
      unknown
    >;
    if (!data || typeof data !== 'object') return { drama, episodes: [] };
    // 详情响应通常含 vod_name/vod_pic/vod_remarks，合并进 drama 使其自包含（不依赖列表上下文）。
    const enriched: Drama = {
      id: drama.id,
      title: String(data['vod_name'] ?? data['title'] ?? drama.title ?? ''),
      coverURL:
        ((data['vod_pic'] as string | null) ??
          (data['coverURL'] as string | null) ??
          (drama.coverURL ?? null)),
      remark:
        ((data['vod_remarks'] as string | null) ??
          (data['remark'] as string | null) ??
          (drama.remark ?? null)),
      episodeCount: null,
    };
    const episodes = parsePlayUrl(String(data['vod_play_url'] ?? '')).map<Episode>((e) => ({
      id: e.id,
      index: e.index,
      title: e.title,
      playURL: e.playURL,
    }));
    return { drama: enriched, episodes };
  }

  async liveChannels(): Promise<LiveChannel[]> {
    const out: LiveChannel[] = [];
    try {
      const sources = this.asMapList(await this.get('/api/live/sources', {}));
      for (const s of sources) {
        const sid = String(s['id'] ?? s['key'] ?? s['sid'] ?? '');
        this.addChannel(out, s, String(s['group'] ?? s['name'] ?? '直播'));
        if (!sid) continue;
        try {
          const channels = this.asMapList(await this.get('/api/live/channels', { sid }));
          for (const c of channels) {
            this.addChannel(out, c, String(c['group'] ?? s['name'] ?? '直播'));
          }
        } catch {
          // 单个源失败不影响其它源
        }
      }
    } catch {
      // 网关未实现直播端点 → 交给 UI 回退演示频道
    }
    return out;
  }

  private addChannel(out: LiveChannel[], m: Record<string, unknown>, group: string) {
    const url = String(m['url'] ?? m['stream'] ?? m['playURL'] ?? '');
    const name = String(m['name'] ?? m['title'] ?? m['channel'] ?? '');
    if (!url || !name) return;
    out.push({ name, group, url });
  }

  private asMapList(data: unknown): Record<string, unknown>[] {
    let raw: unknown[] | undefined;
    if (Array.isArray(data)) {
      raw = data;
    } else if (data && typeof data === 'object') {
      for (const key of ['channels', 'sources', 'list', 'data', 'items']) {
        if (Array.isArray((data as Record<string, unknown>)[key])) {
          raw = (data as Record<string, unknown>)[key] as unknown[];
          break;
        }
      }
    }
    if (!raw) return [];
    return raw.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object');
  }
}

function dramaFromTvbox(m: Record<string, unknown>): Drama {
  return {
    id: String(m['vod_id'] ?? m['id'] ?? ''),
    title: String(m['vod_name'] ?? m['title'] ?? ''),
    coverURL: ((m['vod_pic'] as string | null) ?? (m['coverURL'] as string | null) ?? null),
    remark: ((m['vod_remarks'] as string | null) ?? (m['remark'] as string | null) ?? null),
    episodeCount: null,
  };
}
