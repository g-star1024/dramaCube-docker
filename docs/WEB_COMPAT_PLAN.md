# hongguo-desktop 的 Web 兼容改造清单（路线 B 前置）

> 本文是 `dramaCube-docker`（Web 部署壳）的**前置**说明：要让 CI / `build.sh` 能成功产出
> `flutter build web` 产物，私有源码仓 `hongguo-desktop` 必须先对 Web 编译兼容。
> 本文档只做**方案**梳理，改造在 `hongguo-desktop` 仓库进行，本部署壳不碰源码。

---

## 0. 已勘察的现状（事实基础）

- **工程位置**：`hongguo-desktop` 是单体仓，真正的 Flutter 工程在 **`apps/flutter/`**（pubspec.yaml 在此，不在仓根）。
- **播放内核**：`media_kit` / `media_kit_video` / `media_kit_libs_video`（libmpv 系，**不支持 Web**），在 8 个文件直接 `import`：
  - `lib/core/platform/player_registry.dart`
  - `lib/features/nas/nas_page.dart`、`nas_cover_generator.dart`
  - `lib/features/tv/tv_player_osd.dart`、`tv_pages.dart`
  - `lib/features/live/live_page.dart`
  - `lib/features/player/player_page.dart`
  - `lib/main.dart`（含 `MediaKit.ensureInitialized()`）
- **桌面专属依赖**（pubspec 直接声明，会导致 `flutter build web` 报 "X does not support web"）：
  `window_manager`、`tray_manager`、`local_notifier`、`screen_brightness`；
  本地网关 `gateway_server.dart` 用 `dart:io` 的 `ServerSocket`。
- **`dart:io` 顶层 import** 出现在约 25 个文件（Platform / File / Directory / Process 等），Web 不可用。
- **已有 `kIsWeb` 守卫**散点存在（`dpad_manager`、`shortcut_bindings`、`settings_page`、`search_page`、`player_page`），说明代码已半 web-aware。
- `web/` 目录已 scaffold（`index.html` + `manifest.json`），但尚未接入 hls.js。

---

## 1. 核心原则

1. **不新建独立 Web 代码库**——Web 只是同一套 `lib/` 的编译目标，与 Mac 原生/Android/TV 同源。
2. **`media_kit` 永不进入 Web 编译图**：用条件导入（`if (dart.library.html)`）隔离，桌面实现才 import 它。
3. **桌面专属子系统在 Web 上通过路由/依赖桩禁用**，而非改写逻辑：NAS 本地浏览、种子/磁力下载、本地网关、托盘、窗口管理、系统通知、本地备份导出。
4. **播放层抽象**：`PlayerController` 接口 + Native(`media_kit`) / Web(`video`+`hls.js`) 两套实现。

---

## 2. 改造阶段

### P0 — 让 `flutter build web` 通过编译（最关键，卡住一切）

**A. 处理 Web 不兼容依赖**（pubspec.yaml）
`window_manager` / `tray_manager` / `local_notifier` / `screen_brightness` / `media_kit*` 不支持 Web，
直接声明会让 web build 直接报错。两种处理方式二选一：
- **方式①（推荐）构建时 sed 移除**：在 `build.sh` / CI 里 `flutter build web` 前，用脚本把这些行从临时 pubspec 移除再 `pub get`。
  优点：桌面/移动 pubspec 保持干净；缺点：web 构建脚本多一步。
- **方式② 内部桩包 + `dependency_overrides`**：为这些包各建一个空实现桩（仅含空 plugin 注册），web 构建时 override 指向桩。
  优点：无需改 pubspec 结构；缺点：要维护桩包。

**B. 处理 `dart:io` 顶层 import**
- 全部改为条件导入：`import 'dart:io' if (dart.library.html) 'package:dramacube/web_io_stub.dart';`
- 或封装 `lib/core/platform/io_compat.dart`：导出 Web 安全的 `Platform`（Web 上用 `kIsWeb` + `navigator.userAgent` 模拟 `operatingSystem`）、`File`/`Directory` 走 IndexedDB 桩或抛 `UnsupportedError`。
- 重点改 `lib/main.dart` 顶部：`Platform.operatingSystem` 直接用于启动日志，必须改成 `kIsWeb ? 'web' : Platform.operatingSystem`。

### P1 — 播放层抽象（核心交付）

新建 `lib/core/platform/player/`：
- `player_controller.dart`：`abstract class PlayerController`（open / play / pause / seek / dispose / position 流）
- `player_native.dart`：`import 'package:media_kit/...'` 实现（桌面/移动）
- `player_web.dart`：用 `dart:html` 的 `VideoElement` + 动态加载 `hls.min.js`，**不 import media_kit**
- 末尾用条件导出工厂：
  ```dart
  // player_controller.dart
  export 'player_native.dart' if (dart.library.html) 'player_web.dart';
  ```
- 把上面 8 处 `media_kit` 直接 import 改为调用 `PlayerController` 工厂；
- 现有 `player_registry.dart` 的 `Set<Player>` 改为 `Set<PlayerController>`，`disposeAll` 同时兼容（Web 上 dispose 释放 video 元素）。

### P2 — hls.js 接线（Web 播放）

- `web/index.html`：加入 `<script src="hls.min.js"></script>`（部署壳已把 `hls.min.js` 预置到产物根，离线可用）；
  或在 `player_web.dart` 运行时动态 inject（更灵活）。
- `player_web.dart`：
  - 创建 `VideoElement()`，用 `HtmlElementView(viewType: 'dramacube-video')` 嵌入 Flutter widget 树；
  - `.m3u8`：检测 `window.Hls`——存在则 `Hls().loadSource(url); Hls().attachMedia(video)`；
    Safari 等原生支持 HLS 的浏览器直接 `video.src = url`；
  - 普通 mp4：直接 `video.src`；
  - 全屏/画中画：`video.requestFullscreen()` / `video.webkitSetPresentationMode`。

### P3 — 桌面专属子系统在 Web 上禁用（路由/桩）

- `gateway_server`（本地网关，LAN 设备访问桌面用）：Web 无本地服务，main.dart 里用 `if (!kIsWeb)` 包起来，不启动。
- `windows_tray_service` / 系统通知 / 窗口管理：Web 上 no-op（条件导入桩）。
- NAS 本地浏览 + 封面生成（依赖 libmpv 截帧 + 外部 ffmpeg `Process`）：Web 上**隐藏入口**，仅保留远程流播放。
- 种子/磁力下载（`lt_bindings` + 原生 so）：Web 上**隐藏**，标记为"桌面端功能"。
- 备份导出/导入（`file_picker` + `dart:io`）：Web 上禁用或改用浏览器下载。

### P4 — 验证

- 本机：`cd apps/flutter && flutter build web --release` 通过；
- 用 `dramaCube-docker` 的 `build.sh`（已修正默认指向 `apps/flutter`）或 CI 跑通打包；
- 浏览器打开：播放一个 `.m3u8` 验证 hls.js 接管，SPA 路由正常。

---

## 3. 风险与待拍板点

| # | 决策点 | 建议 |
|---|--------|------|
| Q1 | Web 版功能范围：全功能（含 NAS/下载）还是轻量（仅播放/浏览远程）？ | **轻量优先**，否则 P3 工作量翻数倍 |
| Q2 | P0-A 的两种依赖处理方式（sed 临时移除 vs 内部桩包）偏好？ | 推荐 **sed 临时移除**，pubspec 对桌面/移动保持干净 |
| Q3 | hls.js 打包进产物（离线可用）还是走 CDN？ | 当前部署壳已**预置到产物根**，推荐保持（离线可用） |

---

## 4. 与本部署壳的接口边界

- 本仓 `Dockerfile` 只 `COPY build/web`；`hls.min.js` 由 `build.sh`/CI 在构建前放入产物根。
- Web 播放层**具体接线属于源码仓的 `kIsWeb` 分支**，本仓不碰。
- 任何 `flutter build web` 失败都属 `hongguo-desktop` 侧 task，本仓打包逻辑无需改动。
