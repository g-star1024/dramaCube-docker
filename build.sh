#!/usr/bin/env bash
# 本地构建 Flutter Web 产物并打包 nginx 镜像（需本机已安装 Flutter + Docker）。
#
# 用法：./build.sh [私有源码仓内 Flutter 工程路径，默认 ../hongguo-desktop/apps/flutter]
#
# 设计要点：
#   * hongguo-desktop 是单体仓，Flutter 工程在 apps/flutter/ 子目录。
#   * 使用 Web 专用入口 lib/main_web.dart：不 import 桌面 app/router，
#     磁力下载（dart:ffi）等桌面模块不进入 Web 编译图。
#   * Q2：构建前在【临时副本】生成移除桌面专属依赖的 pubspec；失败自动回退原始 pubspec。
#     源码仓 pubspec.yaml 永不落盘改动。
#   * 本脚本只构建并打包，不修改任何源码。hls.min.js / 离线演示流由源码仓
#     apps/flutter/web/ 随产物带出；产物再由 prepare_web_output.py 收口。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${1:-$ROOT/../hongguo-desktop/apps/flutter}"
SRC="$(cd "$SRC" && pwd)"
OUT="$ROOT/build/web"
ENTRY="lib/main_web.dart"

if [ ! -f "$SRC/pubspec.yaml" ]; then
  echo "❌ 未找到 Flutter 工程：${SRC}（应包含 pubspec.yaml）"
  echo "   例如：./build.sh /path/to/hongguo-desktop/apps/flutter"
  exit 1
fi
# 本机 Flutter 常见安装位置（macOS 开发机常未加入 PATH）；CI 里 flutter-action 已加 PATH
if ! command -v flutter >/dev/null 2>&1; then
  for candidate in "$HOME/development/flutter/bin" "$HOME/flutter/bin" "$HOME/fvm/default/bin"; do
    if [ -x "$candidate/flutter" ]; then
      export PATH="$candidate:$PATH"
      echo "▶ 自动探测到 Flutter SDK：$candidate"
      break
    fi
  done
fi
if ! command -v flutter >/dev/null 2>&1; then
  echo "❌ 未找到 flutter，请把 Flutter SDK 的 bin 加入 PATH"
  exit 1
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/dramacube-web.XXXXXX")"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT INT TERM

echo "▶ 复制源码工程到临时副本（源码仓零改动）：$WORK"
mkdir -p "$WORK"
# 只复制构建必需内容，排除 build/ .dart_tool/ .git/ 等大目录
for item in lib web assets pubspec.yaml pubspec.lock .metadata analysis_options.yaml; do
  [ -e "$SRC/$item" ] && cp -R "$SRC/$item" "$WORK/"
done

cd "$WORK"
cp pubspec.yaml pubspec.original.yaml

echo "▶ Q2：生成 Web 专用 pubspec（移除桌面专属依赖）"
python3 "$ROOT/scripts/prepare_web_pubspec.py" pubspec.original.yaml pubspec.yaml

build_web() {
  flutter pub get
  # --no-web-resources-cdn：canvaskit 改为产物内本地资源。
  # 内网 / NAS 离线部署无外网，默认走 gstatic CDN 会白屏（实测 2026-11-10）。
  # 注意：该参数不覆盖字体回退，字体由 prepare_web_output.py 本地化处理。
  flutter build web --release -t "$ENTRY" --no-wasm-dry-run --no-web-resources-cdn
}

echo "▶ 构建 Flutter Web（${ENTRY}）..."
if ! build_web; then
  echo "⚠️ Web 专用 pubspec 构建失败，回退到原始 pubspec 再试一次"
  cp pubspec.original.yaml pubspec.yaml
  build_web
fi

echo "▶ 复制产物到 ${OUT}，并执行离线部署后处理..."
rm -rf "$ROOT/build"
mkdir -p "$ROOT/build"
cp -R "$WORK/build/web" "$OUT"
# 产物后处理（与 CI 完全同一脚本）：本地化字体回退、注销 Service Worker、
# 精简 dart2js 用不到的 skwasm/symbols、校验 hls.min.js。全程不联网。
# hls.min.js 与离线演示流由源码仓 apps/flutter/web/ 随构建产物带出；
# vendor/ 提供兜底副本，任何情况下都不会回退 CDN。
python3 "$ROOT/scripts/prepare_web_output.py" "$OUT" "$ROOT"

echo "▶ 构建 nginx 镜像 dramacube-web:local..."
cd "$ROOT"
docker build -t dramacube-web:local .

echo "✅ 完成。运行：docker run -p 8080:80 dramacube-web:local  然后访问 http://localhost:8080"
