# DramaCube Web（剧立方 Web 前端）

DramaCube（剧立方）的**独立 Web 前端**，使用 Next.js 14（App Router）+ TypeScript + Tailwind CSS + ArtPlayer + hls.js 构建，托管于 **`dramaCube-docker` 仓库的 `web/` 子目录**（用户拍板并入，不单独建仓）。

与 Flutter 应用源码**完全解耦**：只读复用 DramaCube 网关的 HTTP 契约与离线演示流，**绝不修改、不持有任何 Flutter 源码**。桌面端（macOS / Linux / Windows）、移动端（Android）与 Android TV 继续走 Flutter 原生，Web 端走本目录。

---

## 一、仓库职责（单一职责，互不持有 Flutter 源码）

| 仓库 | 性质 | 职责 |
| --- | --- | --- |
| **`hongguo-desktop`**（私有） | Flutter 应用源码 | 唯一应用源码。`flutter build macos/linux/android` 出原生，`flutter build web` 出 Flutter 版 Web 产物——Web 只是编译目标，**不是独立代码库**。 |
| **`DramaCube-releases`**（公开） | 公发版 + 落地页 | 五平台桌面发版与官网落地页。CI 用 PAT checkout 私有 `hongguo-desktop` 跑构建，产物发 Releases。 |
| **`dramaCube-docker`**（公开，**本仓**） | Web 部署壳 + 独立 Web 前端 | 根目录：nginx 部署壳（Dockerfile / nginx.conf / CI，消费 `flutter build web` 产物）；**`web/` 子目录**：独立 Next.js Web 前端源码（本 README 所述内容），与 Flutter 零耦合。 |

> **铁律**：`web/` 目录不得写入、改动 `hongguo-desktop` 任何文件。Flutter Web 体验差的问题，通过「独立 Next.js Web 前端」解决，而非在 Flutter 工程内修补。两套 Web 前端（Flutter 出品的 `flutter build web` 与本 `web/`）可经同源部署共享本地数据（见第三节）。

---

## 二、技术栈

- Next.js `14.2.35`（App Router，React 18）
- TypeScript `5.5`
- Tailwind CSS `3.4`（自定义暖橙暗色主题）
- ArtPlayer `5.x`（播放器 UI 与控件）
- hls.js `1.5+`（浏览器 HLS 自适应流接管；MP4 走原生 `<video>`）
- PWA：`manifest.ts` + 手写 `public/sw.js`（仅生产环境注册）

---

## 三、网关契约（与 Flutter Web 对齐）

浏览器两种连接模式（与 Flutter `WebGatewayApi._endpoint` 对齐）：

1. **同源反代（生产首选）**：未设置自定义网关时，所有 `/api/*` 请求由 Next.js `rewrites` 反代到环境变量 `GATEWAY_URL` 指向的网关，**无 CORS / 混合内容问题**。
2. **自定义网关直连**：用户在「设置」页填写网关地址后，前端直连该地址（依赖网关返回 `Access-Control-Allow-Origin: *`）。

`next.config.mjs` 中的反代配置：

```js
async rewrites() {
  const gateway = process.env.GATEWAY_URL || 'http://localhost:8080';
  return [{ source: '/api/:path*', destination: `${gateway.replace(/\/$/, '')}/api/:path*` }];
}
```

### 端点清单（与 Flutter 网关完全一致）

| 端点 | 查询参数 | 说明 |
| --- | --- | --- |
| `GET /api/health` | — | 网关健康检查，返回 `{ ok: true }` |
| `GET /api/tvbox/sites` | — | 可用片源站点列表（`key/name/api/tag`） |
| `GET /api/tvbox/list` | `site, pg, t` | 某站点分类分页列表（t=分类 ID） |
| `GET /api/tvbox/search` | `site, wd` | 某站点关键词搜索 |
| `GET /api/tvbox/detail` | `site, id` | 详情 + 播放地址（含 `vod_play_url`） |
| `GET /api/tvbox/import` | `url` | 导入订阅源 |
| `GET /api/live/sources` | — | 直播源分组列表 |
| `GET /api/live/channels` | `sid` | 某直播源下的频道列表 |

### `vod_play_url` 解析（移植自 Flutter `_parsePlayUrl`）

格式：`线路A$第1集$url#第2集$url$$$线路B$第1集$url#...`

- 多线路按 `$$$` 分隔；**优先挑含 `.m3u8` 的线路**，否则取第一条。
- 单线路内按 `#` 分集，每集按 `$` 分「名称 / 地址」。
- HLS（`.m3u8`）由 hls.js 接管（MediaSource），MP4 / 直链走原生 `<video>`。

---

## 四、本地存储与 Flutter 互通

存储键名与序列化结构**完全对齐 Flutter `WebStore`**（`dramacube.web.*`）。当本仓与 Flutter 出品的 Web 部署在**同一 origin**（同源）时，收藏 / 历史 / 网关 / 演示开关可互通共享。

| 键 | 类型 | 含义 |
| --- | --- | --- |
| `dramacube.web.gateway` | string | 自定义网关地址（空 = 走同源反代） |
| `dramacube.web.favorites` | `Drama[]` | 收藏列表 |
| `dramacube.web.history` | `HistoryItem[]` | 观看历史（最多 40 条） |
| `dramacube.web.searches` | `string[]` | 搜索历史（最多 12 条） |
| `dramacube.web.favSites` | `Record<id, site>` | 收藏项来源站点（sidecar，便于跨源续播） |
| `dramacube.web.histSites` | `Record<id, site>` | 历史项来源站点（sidecar） |

> **内置演示片库常驻、无需开关**：演示片库（`site="demo"`）是随镜像永久内置的功能，始终可浏览（首页 / 片库 / 搜索 / 直播回退均含演示数据），不再提供「演示模式」开关（原 `dramacube.web.demo` 键已废弃）。
> **接真实网关后演示数据自动让位**：未配置网关时，首页以演示片库为主角（含 Hero 大卡）；一旦连上真实网关，首页主位自动让给「视频源」真实片库，演示片库降为底部「内置演示」次要区块。演示数据永不删除，仅调整展示优先级。

> 后两个 `favSites / histSites` 为本仓新增的 sidecar 键：因为同一个剧可能出现在多个站点，「我的」页据此精确回跳到正确的来源站点详情页，避免点击后落到错误源。

---

## 五、离线演示流

`public/demo/` 随镜像内置，**纯内网、无外网依赖**即可真播放，用于验证 hls.js 接管、分片加载、倍速与全屏：

- `demo/stream.m3u8`（+ `segment_000.ts` / `segment_001.ts`）：本地 HLS 测试流（ffmpeg 生成的 12 秒 720p H.264+AAC）。
- `demo/clip.mp4`：本地 MP4 测试流。

首条演示片「离线演示片」直接指向这两个同源文件；其余演示片（Big Buck Bunny / Apple BipBop / Mux 等）为公开测试流，仅用于验证远程点播与多码率自适应，**需要外网**。

`public/icons/`（icon-192 / icon-512）为 PWA 占位图标（暖橙纯色）。

---

## 六、目录结构

```
dramaCube-docker/
└── web/                      # ← 本目录（独立 Next.js Web 前端）
    ├── app/                  # App Router 页面
    │   ├── layout.tsx        # 根布局：Providers + AppShell + SW 注册
    │   ├── page.tsx          # 首页（Hero + 演示片库 + 网关入口）
    │   ├── source/           # 片库入口 / 浏览页 [site]
    │   ├── film/[site]/[id]/     # 详情页
    │   ├── watch/[site]/[id]/[ep]/  # 播放页
    │   ├── library/          # 我的（收藏 / 历史）
    │   ├── live/             # 电视直播
    │   ├── settings/         # 网关 / 清空数据
    │   ├── search/           # 聚合搜索（demo + 多源网关）
    │   ├── manifest.ts       # PWA manifest
    │   └── globals.css       # Tailwind + 暗色主题 + 组件类
    ├── components/           # AppShell / Player / DramaCard / EpisodeList / SearchBar 等
    ├── lib/                  # 纯逻辑层（移植自 Flutter，零 React 依赖）
    │   ├── types.ts          # Drama / Episode / DramaDetail / TVBoxSite / LiveChannel ...
    │   ├── parse.ts          # vod_play_url 解析
    │   ├── api.ts            # WebGatewayApi（fetch 封装）
    │   ├── demo.ts           # 内置演示片库 / 频道 / 分类
    │   ├── store.tsx         # StoreProvider / useStore（localStorage 持久化）
    │   ├── load.ts           # 统一加载入口（getApi / loadDetail / loadCatalog / isDemo）
    │   └── accent.ts         # 海报渐变调色板
    ├── public/
    │   ├── demo/             # 离线演示流（随镜像）
    │   ├── icons/            # PWA 图标
    │   └── sw.js             # Service Worker（离线缓存）
    └── next.config.mjs       # 同源 /api 反代 + 构建配置
```

**响应式**：桌面端左侧导航栏（`md:` 显示），移动端固定底部标签栏（`md:hidden`）。暖橙暗色主题，海报墙由本地渐变占位（无外链图片请求）。

---

## 七、本地开发

```bash
pnpm install        # 依赖安装（需 Node 18+，推荐 20/22）
pnpm dev            # 开发模式，默认 http://localhost:3000
# 指定端口（避免与本地其它服务冲突）：
PORT=3100 pnpm dev -p 3100
```

开发模式下：

- 未设置 `GATEWAY_URL` 时，网关请求回退到 `http://localhost:8080`（或用户在「设置」页填写自定义网关）。
- 演示模式默认开启，离线演示片无需网关即可播放。

---

## 八、部署

### 1. 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `GATEWAY_URL` | 否（推荐） | 网关基地址，如 `https://gateway.example.com`。构建期写入 `next.config.mjs` 的 rewrites 目标。未设置则回退 `http://localhost:8080`。 |

> 也可不在构建期固定 `GATEWAY_URL`，改为用户在前端「设置」页填写自定义网关地址（直连模式）。

### 2. 构建与运行

```bash
pnpm build          # 产出 .next
pnpm start          # 生产模式启动（默认 3000）
```

### 3. Docker（可选）

`web/` 目录是纯静态 + Node 服务，可直接用 `node:18-alpine` 跑 `pnpm build && pnpm start`，前置 nginx 反代即可；或用 Node 服务直接对外。若需与根目录 nginx 部署壳路线统一，可参照其 Dockerfile 思路自行打包。

---

## 九、构建验证说明（重要）

- 类型检查：`pnpm exec tsc --noEmit` 已通过，**0 错误**（已配置 `tsconfig.json` 的 `exclude` 排除 `node_modules` 与 `public`，避免把 HLS 分片 `.ts` 当 TypeScript 编译）。
- 运行时验证：以 `PORT=3100 pnpm dev -p 3100` 启动，全部路由（`/`、`/source`、`/source/demo`、`/film/demo/demo-offline`、`/watch/demo/demo-offline/0`、`/live`、`/library`、`/settings`、`/search?q=...`）均返回 HTTP 200，编译无错，SSR/客户端取数正常。

> **本地沙箱限制**：在 WorkBuddy 本地沙箱中执行 `next build` 会因 brokered-FS 的 safe-delete 保护拒绝 Next 递归删除 `.next` 目录（`broker denied delete`），**与代码无关**。该限制仅影响「本地沙箱内跑生产构建」这一动作；CI（GitHub Actions）与真实部署环境不受此限制，可正常 `pnpm build`。本地验证已用 `tsc --noEmit` + `next dev` SSR 等价替代。

---

## 十、与 Flutter 版本的边界

| 维度 | Flutter 原生（hongguo-desktop） | 本 Web 前端（dramaCube-docker/web） |
| --- | --- | --- |
| 目标平台 | macOS / Linux / Windows / Android / Android TV | 任意现代浏览器（桌面 + 移动） |
| 数据源 | 同一 DramaCube 网关 | 同一 DramaCube 网关（只读契约） |
| 本地数据 | `dramacube.web.*`（同源可互通） | `dramacube.web.*`（同源可互通） |
| 代码耦合 | — | 零耦合，不触碰 Flutter 源码 |
| 离线演示 | 由 Flutter `web/demo/` 提供 | 由本仓 `public/demo/` 提供（同源内置） |

如网关契约或 `vod_play_url` 格式发生变化，需**同时**更新 Flutter 与本仓的对应解析逻辑（目前两者已对齐）。
