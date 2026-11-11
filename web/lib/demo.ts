// 内置演示片库（移植自 Flutter web_demo_data.dart）。
// 纯静态数据；封面由本地渐变生成（无外链图片）。
// 首条「离线演示片」指向 public/demo/ 下的同源本地流（需本仓自带，无需外网）；
// 其余为公开测试流（需外网），仅用于验证远程点播与多码率自适应。
// 注意：离线演示流由本仓 public/demo/ 提供，而非 Flutter 的 web/demo/。

import type { DemoItem, DemoChannel, Drama } from './types';

const MUX = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const APPLE_MASTER =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8';
const APPLE_VARIANT =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8';
const BUCKET = 'https://storage.googleapis.com/gtv-videos-bucket/sample';

// 随镜像内置的离线演示流（public/demo/，同源相对路径，无外网依赖）。
const OFFLINE_HLS = 'demo/stream.m3u8';
const OFFLINE_MP4 = 'demo/clip.mp4';

export const kDemoItems: DemoItem[] = [
  {
    drama: { id: 'demo-offline', title: '离线演示片', remark: '随镜像内置 · 12 秒' },
    summary:
      '完全随镜像内置的本地 HLS / MP4 测试流，纯内网也能真播放，用于验证 hls.js 接管、分片加载、倍速与全屏。无需外网、无需网关。',
    category: '离线演示',
    tag: '离线',
    accent: 3,
    episodes: [
      { id: '0', index: 0, title: '本地 HLS（hls.js）', playURL: OFFLINE_HLS },
      { id: '1', index: 1, title: '本地 MP4（原生）', playURL: OFFLINE_MP4 },
    ],
  },
  {
    drama: { id: 'demo-bigbuck', title: 'Big Buck Bunny', remark: '开源动画短片 · 10 分钟' },
    summary: 'Blender 基金会开源短片，用于验证 MP4 直链播放与浏览器原生 <video> 链路。',
    category: '电影',
    tag: 'MP4',
    accent: 0,
    episodes: [
      { id: '0', index: 0, title: '正片', playURL: `${BUCKET}/BigBuckBunny.mp4` },
      { id: '1', index: 1, title: '演示分集 A', playURL: `${BUCKET}/ForBiggerBlazes.mp4` },
      { id: '2', index: 2, title: '演示分集 B', playURL: `${BUCKET}/ForBiggerJoyrides.mp4` },
    ],
  },
  {
    drama: { id: 'demo-apple-hls', title: 'Apple BipBop', remark: '多码率 HLS 测试流' },
    summary: '苹果官方 HLS 示例流，用于验证 hls.js 的 MediaSource 接管、自适应码率与多线路切换。',
    category: '演示 HLS',
    tag: 'HLS',
    accent: 1,
    episodes: [
      { id: '0', index: 0, title: '主线路 fMP4', playURL: APPLE_MASTER },
      { id: '1', index: 1, title: '备用线路 4x3', playURL: APPLE_VARIANT },
    ],
  },
  {
    drama: { id: 'demo-mux', title: 'Mux Test Stream', remark: 'HLS 点播测试流' },
    summary: 'Mux 公开测试流，验证 HLS 分片加载、播放/暂停、倍速与全屏控制。',
    category: '演示 HLS',
    tag: 'HLS',
    accent: 3,
    episodes: [{ id: '0', index: 0, title: '播放', playURL: MUX }],
  },
  {
    drama: { id: 'demo-sintel', title: 'Sintel', remark: 'Blender 开源短片' },
    summary: 'Blender 开源电影 Sintel，用于验证长视频 MP4 的拖动进度与缓存表现。',
    category: '电影',
    tag: 'MP4',
    accent: 4,
    episodes: [{ id: '0', index: 0, title: '正片', playURL: `${BUCKET}/Sintel.mp4` }],
  },
  {
    drama: { id: 'demo-tears', title: 'Tears of Steel', remark: 'Blender 开源短片' },
    summary: 'Blender 开源科幻短片，验证高清 MP4 在浏览器中的解码与全屏显示。',
    category: '电影',
    tag: 'MP4',
    accent: 5,
    episodes: [{ id: '0', index: 0, title: '正片', playURL: `${BUCKET}/TearsOfSteel.mp4` }],
  },
  {
    drama: { id: 'demo-elephants', title: 'Elephants Dream', remark: 'Blender 开源短片' },
    summary: 'Blender 首部开源电影，用于验证海报墙、详情页与播放页的完整跳转链路。',
    category: '电影',
    tag: 'MP4',
    accent: 2,
    episodes: [{ id: '0', index: 0, title: '正片', playURL: `${BUCKET}/ElephantsDream.mp4` }],
  },
  {
    drama: { id: 'demo-blazes', title: 'For Bigger Blazes', remark: '短片 · 15 秒' },
    summary: 'Google 公开样片，适合快速验证起播速度与自动播放策略。',
    category: '短片',
    tag: 'MP4',
    accent: 6,
    episodes: [{ id: '0', index: 0, title: '播放', playURL: `${BUCKET}/ForBiggerBlazes.mp4` }],
  },
  {
    drama: { id: 'demo-escapes', title: 'For Bigger Escapes', remark: '短片 · 15 秒' },
    summary: 'Google 公开样片，用于验证连续切换分集时 <video> 与 hls.js 的清理逻辑。',
    category: '短片',
    tag: 'MP4',
    accent: 7,
    episodes: [{ id: '0', index: 0, title: '播放', playURL: `${BUCKET}/ForBiggerEscapes.mp4` }],
  },
];

export const kDemoChannels: DemoChannel[] = [
  { name: '离线演示频道 · 本地 HLS', group: '离线', url: OFFLINE_HLS, accent: 3 },
  { name: '演示频道 · HLS 主线路', group: '演示', url: MUX, accent: 1 },
  { name: '演示频道 · 多码率', group: '演示', url: APPLE_MASTER, accent: 0 },
  { name: '演示频道 · 备用线路', group: '演示', url: APPLE_VARIANT, accent: 3 },
  { name: '演示频道 · 点播流', group: '演示', url: `${BUCKET}/ForBiggerFun.mp4`, accent: 5 },
];

export const kDemoCategories: string[] = ['全部', '离线演示', '电影', '演示 HLS', '短片'];

export function accentFor(seed: string): number {
  let acc = 0;
  for (let i = 0; i < seed.length; i++) acc += seed.charCodeAt(i);
  return acc % 8;
}

export function demoById(id: string): DemoItem | undefined {
  return kDemoItems.find((it) => it.drama.id === id);
}

export function demoDramaById(id: string): Drama | undefined {
  return demoById(id)?.drama;
}
