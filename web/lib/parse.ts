// vod_play_url 解析器（移植自 Flutter web_api.dart 的 _parsePlayUrl）。
// 格式：线路A$第1集$url#第2集$url$$$线路B$第1集$url#...
// 多线路：优先挑含 .m3u8 的线路，否则第一条；每段按 # 分集、按 $ 分「名称/地址」。

export function parsePlayUrl(raw: string): { id: string; index: number; title: string; playURL: string }[] {
  const text = (raw ?? '').trim();
  if (!text) return [];

  const groups = text.split('$$$').map((g) => g.trim()).filter((g) => g.length > 0);
  if (groups.length === 0) return [];

  const chosen =
    groups.find((g) => g.toLowerCase().includes('.m3u8')) ?? groups[0];

  const episodes: { id: string; index: number; title: string; playURL: string }[] = [];
  for (const part of chosen.split('#')) {
    const seg = part.trim();
    if (!seg) continue;
    const pieces = seg.split('$');
    let name: string;
    let url: string;
    if (pieces.length >= 2) {
      name = pieces[0].trim();
      url = pieces.slice(1).join('$').trim();
    } else {
      name = `第${episodes.length + 1}集`;
      url = pieces[0].trim();
    }
    if (!url) continue;
    episodes.push({
      id: `${episodes.length}`,
      index: episodes.length,
      title: name || `第${episodes.length + 1}集`,
      playURL: url,
    });
  }
  return episodes;
}
