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
| 1 | **页面白屏** | Flutter 默认从 `gstatic.com` CDN 拉 canvaskit.wasm，内网/NAS 无外网 → `ERR_CONNECTION_CLOSED` | 构建加 `--no-web-resources-cdn`，canvaskit/字体改走产物内本地资源（产物已有 `canvaskit/` 全套） |
| 2 | **Chrome 上 HLS 播不出来** | 用 `canPlayType('application/vnd.apple.mpegurl')` 判断原生支持，Chrome 返回 `"maybe"`（truthy）却并不能播 HLS，误跳过 hls.js | `hls_bridge.js` 改为 **HLS 一律优先交给 hls.js**，仅 `Hls.isSupported()` 为 false（Safari 原生 HLS）或加载失败时走原生 |
| 3 | **改了桥但页面仍加载旧版** | nginx 把所有 `.js` 设成 `immutable` 365 天；`main.dart.js`/`flutter_bootstrap.js`/`hls_bridge.js` 不带内容 hash | 入口文件 `no-cache, must-revalidate`，带 hash 资源才 `immutable` |

---

## 5. 验证结果（真实环境，非空口）

- `flutter build web --release -t lib/main_web.dart` → **✓ Built build/web**（一次通过）
- `./build.sh` 完整闭环 → exit 0，镜像 `dramacube-web:local` **138MB**
- `nginx -t` 通过；根路径/SPA 回退/hls.min.js/hls_bridge.js 全 200；`main.dart.js` gzip 生效
- 浏览器真实渲染：深色影院风格首页、「剧立方 Web」标题、直接播放卡片全部出现；**控制台 0 错误 0 警告**
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
