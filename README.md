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

---

## 本地构建（开发调试）

需本机已装 Flutter + Docker，且能访问私有源码仓 `hongguo-desktop`：

```bash
./build.sh /path/to/hongguo-desktop
# 构建后运行：docker run -p 8080:80 dramacube-web:local
```

`build.sh` 只构建并打包，不修改任何源码。

---

## CI 自动构建镜像

触发：**Actions → build-web-image → Run workflow**，可填：

- `version`：版本号（如 `2.7.83`），用于镜像 `:vX.Y.Z`；留空只推 `:latest`
- `source_ref`：私有源码仓的 ref（默认 `main`）

### 必须配置的 Secret

CI 需要读取私有源码仓 `hongguo-desktop`，请在本仓 **Settings → Secrets → Actions** 添加：

- `SOURCE_TOKEN`：一个具有 `repo`（读取私有仓）权限的 GitHub Personal Access Token

（公共仓 Actions 免费；用 PAT checkout 私有源码，构建完产物不入库。）

---

## 关于播放（video + hls.js）

Web 端的 HLS/视频播放使用浏览器原生 `<video>` + [hls.js](https://github.com/video-dev/hls.js)。
本仓已把 `hls.min.js` 预置到 web 产物根目录（`/hls.min.js`），供 Web 播放层按需加载。

> 播放层的具体接线属于**源码仓 `hongguo-desktop` 的 Web 条件分支**（`kIsWeb` 隔离），由源码侧实现；
> 这样做不会影响桌面原生的 media_kit/libmpv 行为。本仓不碰源码。

---

## 前置条件（源码侧需满足）

`flutter build web` 能成功的前提是 `hongguo-desktop` 已对 Web 兼容：

- 桌面/移动专属插件对 Web 做了 `kIsWeb` 跳过或 Web 实现（如媒体/网关/下载等）
- 播放层在 Web 上走 `video` + `hls.js`，而非 libmpv

若 CI 在 `flutter build web` 步骤失败，通常是上述源码侧 Web 兼容未就绪——属于 `hongguo-desktop` 的 task，
在本仓之外解决即可，本仓打包逻辑无需改动。

---

## 镜像体积

基底 `nginx:alpine` ≈ 40MB，叠加 Flutter Web 资源（JS / assets / 字体）后整体约 100MB 量级，
远低于已废弃的路线 A noVNC 桌面镜像。
