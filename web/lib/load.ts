// 统一数据加载助手：demo 与网关数据走同一入口，页面无需关心来源。
import { WebGatewayApi } from './api';
import { demoById, kDemoItems } from './demo';
import type { Drama, DramaDetail } from './types';

export function getApi(gateway?: string): WebGatewayApi {
  return new WebGatewayApi(gateway);
}

export async function loadDetail(
  site: string,
  id: string,
  gateway?: string,
): Promise<DramaDetail | null> {
  if (site === 'demo') {
    const d = demoById(id);
    if (!d) return null;
    return {
      drama: d.drama,
      episodes: d.episodes.map((e) => ({
        id: e.id,
        index: e.index,
        title: e.title,
        playURL: e.playURL,
      })),
    };
  }
  const api = new WebGatewayApi(gateway);
  return api.detail(site, { id, title: id });
}

export async function loadCatalog(
  site: string,
  opts: { page?: number; keyword?: string; typeId?: string; gateway?: string },
): Promise<Drama[]> {
  if (site === 'demo') {
    // demo 站点直接返回内置片库（分页/搜索由页面本地处理）。
    return kDemoItems.map((d) => d.drama);
  }
  const api = new WebGatewayApi(opts.gateway);
  return api.list({ site, page: opts.page ?? 1, keyword: opts.keyword, typeId: opts.typeId });
}

export function isDemo(site: string): boolean {
  return site === 'demo';
}
