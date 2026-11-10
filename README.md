# 剧立方 DramaCube — Flutter Web 部署（路线 B）

> 轻量 Web 版：原生浏览器体验，nginx 静态托管 Flutter Web 产物，镜像约 100MB。
> 替代已废弃的路线 A（noVNC 桌面镜像，见 [DramaCube-releases](https://github.com/g-star1024/DramaCube-releases)）。

本仓库**只是一个部署壳**：不含任何应用源码，仅负责把 Flutter Web 构建产物用 nginx 托管成镜像。

---

## 架构（为什么不会互相影响）

| 仓库 | 性质 | 职责 |
|------|------|------|
| `hongguo-desktop`（私有） | 私有源码仓 | **唯一的应用源码**：Mac 原生 + Android + Web 共用同一套 `lib/`。Web 只是 `flutter build web` 这个编译目标，不是独立代码库。播放层用 `kIsWeb`/条件导入隔离——Web 用 `video` + `hls.js`，桌面仍是 media_kit/libmpv，**互不影响** |
| `DramaCube-releases`（公开） | 桌面发版 | 五平台桌面二进制发版 + 落地页（路线 A 已删除） |
| **`dramaCube-docker`（本仓，公开）** | **Web 部署壳** | 仅 nginx 打包：`Dockerfile` / `nginx.conf` / CI（从 `hongguo-desktop` 拉 web 产物塞进 nginx）。**不持有、不修改源码** |

关键点：**Web 版与 Mac 原生版是同一套源码的两个编译目标**，所以不存在"三套代码互相冲突"。本仓只消费 `flutter build web` 的**产物**，从源头杜绝了分叉。

---

## 快速体验（拉镜像直接跑）

```bash
docker run -d --name dramacube-web -p 8080:80 \
  ghcr.io/g-star1024/dramacube-docker:latest
```

浏览器打开 **http://localhost:8080**（NAS 部署把 `localhost` 换成 NAS IP，端口自定）。
或用 Compose：`docker compose -f docker-compose.example.yml up -d`。

**功能范围（轻量 Web 版）**：粘贴 m3u8/mp4 地址直接播放；配置网关容器地址后可浏览/搜索视频源。
NAS 本地资源库、磁力下载、本地备份等桌面能力不在 Web 版范围内。
浏览器不能监听端口，本地网关不启动，需在右上角「网关设置」填入网关容器地址
（网关已带 `Access-Control-Allow-Origin: *`）；留空也能用「直接播放」。

**离线 / 内网可用**：构建带 `--no-web-resources-cdn`，canvaskit 与字体走产物内本地资源，
不依赖 gstatic CDN；`hls.min.js` 也预置在产物内，无需外网即可播 HLS。

---

## 本地构建（开发调试）

需本机已装 Flutter + Docker，且能访问私有源码仓 `hongguo-desktop`。注意它是**单体仓**，真正的 Flutter 工程在 `apps/flutter/` 子目录：

```bash
# 默认即指向 ../hongguo-desktop/apps/flutter，可直接运行：
./build.sh
# 或显式传 Flutter 工程路径：
./build.sh /path/to/hongguo-desktop/apps/flutter
# 构建后运行：docker run -p 8080:80 dramacube-web:local
```

`build.sh` 在**临时副本**上构建，源码仓 `pubspec.yaml` 零改动：

1. 用 Web 专用入口 `lib/main_web.dart`（不 import 桌面 `app/router.dart`，磁力下载的 `dart:ffi` 不进编译图）
2. Q2：`scripts/prepare_web_pubspec.py` 临时移除 21 个桌面专属依赖；失败自动回退原始 pubspec
3. `flutter build web --release -t lib/main_web.dart --no-wasm-dry-run --no-web-resources-cdn`
4. 复制产物 + 预置 `hls.min.js` → `docker build`

本机 Flutter SDK 未加入 PATH 时会自动探测 `~/development/flutter/bin` 等常见位置。

---

## CI 自动构建镜像

触发：**Actions → build-web-image → Run workflow**，可填：

- `version`：版本号（如 `2.7.83`），用于镜像 `:vX.Y.Z`；留空只推 `:latest`
- `source_ref`：私有源码仓的 ref（默认 `feat/web-compat`，即 Web 兼容改造分支；
  若该分支已合回 `main`，改成 `main`）

### 必须配置的 Secret

CI 需要读取私有源码仓 `hongguo-desktop`，请在本仓 **Settings → Secrets → Actions** 添加：

- `SOURCE_TOKEN`：一个具有 `repo`（读取私有仓）权限的 GitHub Personal Access Token

（公共仓 Actions 免费；用 PAT checkout 私有源码，构建完产物不入库。）

---

## 关于播放（video + hls.js）

Web 端的 HLS/视频播放使用浏览器原生 `<video>` + [hls.js](https://github.com/video-dev/hls.js)。
本仓已把 `hls.min.js` 预置到 web 产物根目录（`/hls.min.js`），供 Web 播放层按需加载。

播放层接线在源码仓 `hongguo-desktop` 的 **Web 专用入口分支**（`lib/main_web.dart` +
`web/hls_bridge.js`），桌面原有 `.dart` 一个字未改，media_kit/libmpv 行为完全不受影响。
`hls_bridge.js` 中 **HLS 一律优先交给 hls.js**（只有 `Hls.isSupported()` 为 false 的
Safari 原生 HLS 或加载失败才走原生）——不能用 `canPlayType` 判断，Chrome 会返回误导性的 `"maybe"`。

> `SOURCE_TOKEN` 配置详见 [docs/SOURCE_TOKEN.md](docs/SOURCE_TOKEN.md)；
> 源码侧改造与实测记录详见 [docs/WEB_COMPAT_PLAN.md](docs/WEB_COMPAT_PLAN.md)。

---

## 前置条件（源码侧）

`flutter build web` 使用 `hongguo-desktop` 的 `feat/web-compat` 分支（含 Web 专用入口
`lib/main_web.dart`）。**不需要**改动桌面模块、也不需要给 `dart:io` 逐文件加条件导入——
实测编译错误只来自 import 链中的 `dart:ffi`，切断编译图即可。详见改造文档。

---

## 镜像体积

基底 `nginx:alpine` ≈ 40MB，叠加 Flutter Web 产物（canvaskit / main.dart.js / assets / hls.js）
后**实测 138MB**，远低于已废弃的路线 A noVNC 桌面镜像。入口文件 `no-cache`、
带 hash 资源 `immutable`，保证升级后浏览器不会拿到旧文件。
