// DramaCube Web 数据类型。字段命名与 Flutter 的 catalog_models.dart / web_api.dart 完全对齐。

export interface Drama {
  id: string;
  title: string;
  coverURL?: string | null;
  episodeCount?: number | null;
  remark?: string | null;
}

export interface Episode {
  id: string;
  index: number;
  title: string;
  playURL?: string | null;
}

export interface DramaDetail {
  drama: Drama;
  episodes: Episode[];
}

export interface TVBoxSite {
  key: string;
  name: string;
  api: string;
  tag: 'Adult' | 'Ordinary';
}

export interface LiveChannel {
  name: string;
  group: string;
  url: string;
}

export interface DemoEpisode {
  id: string;
  index: number;
  title: string;
  playURL: string;
}

export interface DemoItem {
  drama: Drama;
  summary: string;
  category: string;
  tag: string;
  episodes: DemoEpisode[];
  accent: number;
}

export interface DemoChannel {
  name: string;
  group: string;
  url: string;
  accent: number;
}

export interface HistoryItem {
  drama: Drama;
  episodeIndex: number;
  episodeTitle: string;
  playURL: string;
  at: number; // epoch ms
}
