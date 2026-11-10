# hongguo-desktop 的 Web 兼容改造（路线 B）— 决策与实测记录

> 状态：**已实施并真实验证通过**（2026-11-10，Flutter 3.35.4 / Dart 3.9.2）。
> 改造落在私有仓 `hongguo-desktop` 的 `feat/web-compat` 分支；`main` 与桌面编译路径零改动。
> 本仓（部署壳）不持有、不修改任何应用源码。

---

## 1. 三项决策（用户已拍板「按推荐来」）

| # | 决策 | 结论 | 落地位置 |
|---|------|------|----------|
| Q1 | Web 版功能范围 | **轻量**：浏览远程视频源 + 浏览器内核播放；不含 NAS 本地浏览、磁力/种子下载、本地网关、托盘/窗口、系统通知、本地备份 | 源码 `lib/app/web_app.dart` |
| Q2 | web 不兼容依赖处理 | **构建时临时移除**（`prepare_web_pubspec.py`，在临时副本上，源码仓 pubspec 零改动；失败自动回退原始 pubspec） | 本仓 `scripts/` + `build.sh` + CI |
| Q3 | hls.js 来源 | **预置进产物**（离线可用），桥内失败才回退 CDN | 本仓 `build.sh`/CI 放入产物根 `hls.min.js` |

---

## 2. 编译探针推翻了方案里的两个假设（重要）

先在 `feat/web-compat` 分支跑了一次 `flutter build web`（默认 `lib/main.dart`），拿真实报错：

| 原方案假设 | 实测 | 结论 |
|---|---|---|
| 桌面依赖会让 web build 报 `X does not support web` | **0 次**（pub get 与编译均通过） | Q2 不是编译必需，仅作边界声明 + 减少 pub get |
| ~25 个 `dart:io` 顶层 import 要条件导入 | **0 个 dart:io 报错**（Dart Web 有存根） | 无需逐文件改造 |
| media_kit 8 处 import 要抽象才能编译 | **0 个编译错误** | 编译层不需要动 |

真实报错只集中在 **3 个文件**：`core/torrent/lt_bindings.dart`（296，全 `dart:ffi`）、
`features/downloads/torrent_manager.dart`（7）、`nas/nas_cover_generator.dart`（2，64 位整数字面量 JS 无法精确表示）。
根因是 **import 链把磁力/下载/备份模块拉进了编译图**：
`main.dart → app/app.dart → app/router.dart → panso_page/downloads_page/settings_page → torrent_manager → dart:ffi`。

**因此最终做法不是逐文件打补丁，而是切断编译图**：新增 Web 专用入口
`lib/main_web.dart`，构建时 `-t lib/main_web.dart`。桌面原有 `.dart` **一个字未改**。

---

## 3. 实际改造内容（全部新增，桌面零改动）

### 源码侧 `hongguo-desktop`（feat/web-compat 分支）

| 文件 | 作用 |
|------|------|
| `lib/main_web.dart` | Web 专用入口；不 import `app/app.dart`/`router.dart`，桌面模块不进编译图 |
| `lib/app/web_api.dart` | 直连网关容器的数据层（纯 Dart + dio）；宽容解析 TVBox `vod_play_url` |
| `lib/app/web_app.dart` | 轻量 Web UI：直接播放 + 站点/搜索/海报网格 + 网关设置（localStorage） |
| `lib/features/web_player/web_video_player.dart` | `dart:html` VideoElement + `dart:ui_web` PlatformView + `HtmlElementView` |
| `lib/features/web_player/web_player_page.dart` | 全屏播放页 + 分集切换 |
| `web/hls_bridge.js` | HLS 接线全放 JS 侧，Dart 只创建 `<video>` |
| `web/index.html` | 引入 `hls_bridge.js`、改标题/描述 |

复用了纯 Dart 的 `core/models/catalog_models.dart`（Drama/Episode/TVBoxSite），保持数据模型同源。

### 部署壳侧 `dramaCube-docker`

- `scripts/prepare_web_pubspec.py`：生成 Web 专用 pubspec（移除 21 个桌面专属依赖），输出经 YAML 校验。
- `build.sh`：复制源码到**临时副本** → Q2 → `flutter build web --release -t lib/main_web.dart
  --no-wasm-dry-run --no-web-resources-cdn` → 复制产物 + 预置 `hls.min.js` → `docker build`。
  自动探测本机 Flutter SDK；Q2 构建失败自动回退原始 pubspec。
- CI `build.yml`：`source_ref` 默认 `feat/web-compat`，同样的入口与 Q2/回退逻辑。
- `nginx.conf`：入口文件 `no-cache`、带 hash 资源 `immutable`。

---

## 4. 浏览器实测发现并修复的 3 个真问题

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | **页面白屏** | Flutter 默认从 `gstatic.com` CDN 拉 canvaskit.wasm，内网/NAS 无外网 → `ERR_CONNECTION_CLOSED` | 构建加 `--no-web-resources-cdn`，canvaskit 改走产物内本地资源（实测请求 `/canvaskit/chromium/canvaskit.wasm` 为 200）。**注意：字体回退不在此开关范围内**，见第 7 节已知项 |
| 2 | **Chrome 上 HLS 播不出来** | 用 `canPlayType('application/vnd.apple.mpegurl')` 判断原生支持，Chrome 返回 `"maybe"`（truthy）却并不能播 HLS，误跳过 hls.js | `hls_bridge.js` 改为 **HLS 一律优先交给 hls.js**，仅 `Hls.isSupported()` 为 false（Safari 原生 HLS）或加载失败时走原生 |
| 3 | **改了桥但页面仍加载旧版** | nginx 把所有 `.js` 设成 `immutable` 365 天；`main.dart.js`/`flutter_bootstrap.js`/`hls_bridge.js` 不带内容 hash | 入口文件 `no-cache, must-revalidate`，带 hash 资源才 `immutable` |

---

## 5. 验证结果（真实环境，非空口）

- `flutter build web --release -t lib/main_web.dart` → **✓ Built build/web**（一次通过）
- `./build.sh` 完整闭环 → exit 0，镜像 `dramacube-web:local` **138MB**
- `nginx -t` 通过；根路径/SPA 回退/hls.min.js/hls_bridge.js 全 200；`main.dart.js` gzip 生效
- 浏览器真实渲染（v1 单页版）：深色影院风格首页、「剧立方 Web」标题、直接播放卡片全部出现；当时 **控制台 0 错误 0 警告**（页面中文较少，未触发引擎字体回退）。v2 完整应用壳的中文增多后触发了字体回退请求，见第 7 节。
- 本地 `hls.min.js` 200（623912 字节）、`Hls.isSupported() = true`；Chrome 上 `dcAttachVideo` 生成
  `blob:` MediaSource URL → **hls.js 接管成功（PASS）**
- Q2 生效：移除 21 个依赖、未触发回退；源码仓 `pubspec.yaml` 经 `git diff` 确认零改动

---

## 6. 接口边界与后续

- 本仓 `Dockerfile` 只 `COPY build/web`；`hls.min.js` 由 `build.sh`/CI 在构建前放入产物根。
- Web 版播放层接线属于源码仓的 Web 专用入口分支，桌面 media_kit/libmpv 行为不受影响。
- 浏览器不能监听端口，本地网关（shelf）在 Web 版**不启动**；Web 版直连网关容器地址
  （架构文档 M5 原设计，网关已带 `Access-Control-Allow-Origin: *`）。在右上角「网关设置」填写即可；
  留空也能用「直接播放」。
- 网关容器尚未纳入本仓 compose（Q1 轻量范围）；如需一键带网关部署，是后续独立 task。
- 是否把 `feat/web-compat` 合并回 `main` 属范围裁定，留待用户拍板；在合并前 CI 的
  `source_ref` 必须指向该分支。

---

## 7. v2 完整应用壳（2026-11-10 晚，本轮新增）

### 起因

v1 的首页只有一个「直接播放」输入框 + 一行说明：站点切换 / 搜索 / 分页 / 海报墙 / 网关设置
其实都写了，但被 `if (_gatewayCtrl.text.isNotEmpty)` 整块隐藏，未配网关时看不见。
用户反馈「就只有个播放器么？继续开发」→ 按 **Q1 已拍板的「浏览远程」补齐**，
不新增后端、不碰桌面原有 `.dart`、不改桌面样式。

### 新增 / 重写的源码（全部只在 Web 编译图内）

| 文件 | 作用 |
|------|------|
| `lib/app/web_theme.dart` | 深色影院主题 + 粉/蓝/金/青色彩常量 |
| `lib/app/web_store.dart` | `WebState`（ChangeNotifier）+ `WebScope`（InheritedNotifier）：网关 / 演示模式 / 收藏 / 历史 / 搜索词 / 导航索引，全部 `localStorage` 持久化 |
| `lib/app/web_demo_data.dart` | 内置演示片库（8 部公开测试片 + 4 个演示频道），封面由本地渐变生成，无任何外链图片 |
| `lib/app/web_widgets.dart` | 海报卡 / 演示封面 / 区块标题 / 空态 / 状态胶囊 / 统一 24px 页面内边距 |
| `lib/app/web_app.dart` | `WebApp` + `WebShell`：宽屏 `NavigationRail`（7 项）、窄屏 `NavigationBar`（5 项 + 顶栏入口），`IndexedStack` 保状态 |
| `lib/features/web_library/web_home_page.dart` | 发现页：Hero / 快捷入口 / 继续观看 / 推荐；有网关时异步取第一个站点内容替换推荐 |
| `web_catalog_page.dart` | 片库（站点 / 分类 / 搜索 / 分页）+ 搜索页（演示 + 最多 6 个网关站点） |
| `web_live_page.dart` | 直播页：自定义流 + 演示频道 + 网关 `/api/live/*` 宽容接入 |
| `web_collection_page.dart` | 收藏 / 历史 / 设置（保存+测试连接 / 订阅导入 / 演示开关 / 数据清理） |
| `web_detail_page.dart` | 详情页：海报 / 简介 / 选集 / 同类推荐 / 收藏 / 复制地址；无站点时自动向网关查第一个站点重试 |
| `web_actions.dart` | 统一跳转动作（避免页面互相 import） |
| `lib/features/web_player/web_player_page.dart` | 播放页增强：倍速菜单 / 全屏 / 收藏 / 复制地址 / 播放写历史 |
| `web/hls_bridge.js` | 新增 `dcSetRate` / `dcToggleFullscreen` / `dcPlayerState` |
| `lib/app/web_api.dart` | 补 `liveChannels()` 宽容解析（网关端点未实现时返回空，由 UI 回退演示频道） |

**桌面原有 `.dart` 仍是一个字未改**；`pubspec.yaml` / `pubspec.lock` 保持原样（`flutter pub get` 造成的 lock 单行变化已 `git restore`）。

### 真实浏览器验证（v2，非空口）

- 编译：`flutter build web --release -t lib/main_web.dart --no-wasm-dry-run --no-web-resources-cdn`
  → 第 2 轮 `✓ Built build/web`（首轮仅漏一个 import）。`./build.sh` 闭环 exit 0，Q2 移除 21 个依赖且未回退，镜像 138MB。
- 逐页截图确认：发现 / 片库(8 海报) / 直播(4 频道) / 搜索 / 收藏 / 历史 / 设置(4 卡) / 详情 / 播放页 —— 全部正常渲染、无白屏。
- **真实交互链路**：点海报 → 详情页（3 集选集 + 3 条同类推荐）→ 点「加入收藏」→ 点「立即播放」
  → `localStorage` 里真实写入 favorites 与 history（含 `playURL`）→ `dcPlayerState()` 返回 MP4 地址、
  `hlsAttached=false`（MP4 走原生内核的正确分支）→ 首页「继续观看」出现该片。
- **倍速不是假按钮**：`dcSetRate(1.5)` 后 `dcPlayerState().rate` 从 `1` 变为 `1.5`。
- **双端**：1440px 桌面左侧栏、820px 平板底部栏、390px 手机底部栏（快捷入口 2 列、海报 2 列），
  四向 padding 一致、无贴边、无溢出。
- canvaskit 实测请求本地 `/canvaskit/chromium/canvaskit.wasm`；`hls.min.js` / `hls_bridge.js` / `main.dart.js` 全 200。

### 已知项（如实记录，未做 hack）

1. **字体回退**：Flutter Web 引擎渲染中文时会按 `fontFallbackBaseUrl` 默认值
   `https://fonts.gstatic.com/s/` 下载 Roboto / Noto Sans SC 分片；`--no-web-resources-cdn`
   **不覆盖字体**。纯内网下这些请求失败会在控制台产生 warning，文字回退系统字体，功能不受影响。
   SDK 侧可配 `window.flutterConfiguration.fontFallbackBaseUrl`，但彻底离线需要自带中文字体文件，
   属后续独立 task。
2. **网关直播 / 代理 / NAS 端点目前是 M2 占位**（`gateway_server.dart` 返回空数组 / 404），
   直播页因此展示演示频道并明确标注；前端已做宽容接入，端点实现后无需改前端。
3. **演示片库的公开测试流需外网**才能真正起播；离线环境可粘贴自己的地址，UI 与本地状态完全可用。
4. **升级后需硬刷新**：本次验证时浏览器曾加载缓存的旧 `main.dart.js` 导致看到旧页面；
   nginx 入口已是 `no-cache`，新用户无此问题，老页面按 Ctrl/Cmd+Shift+R 即可。

### 待用户拍板

- 内置演示片库是否保留（设置页「启用内置演示片库」可一键关闭，关闭后未连网关时首页为空）。
- `feat/web-compat` 是否合并回 `hongguo-desktop` 的 `main`（未合前 CI `source_ref` 必须指向该分支）。
