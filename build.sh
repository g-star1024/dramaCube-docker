#!/usr/bin/env bash
# 本地构建 Flutter Web 产物并打包 nginx 镜像（需本机已安装 Flutter + Docker）。
# 用法：./build.sh [私有源码仓 hongguo-desktop 的路径，默认 ../hongguo-desktop]
#
# 说明：本脚本只构建并打包，不修改任何源码。web 播放层所需的 hls.js 会预置到产物根目录。
set -euo pipefail

SRC="${1:-../hongguo-desktop}"
OUT="build/web"

if [ ! -d "$SRC" ]; then
  echo "❌ 未找到私有源码仓：$SRC"
  echo "   请传入 hongguo-desktop 的本地路径，例如：./build.sh /path/to/hongguo-desktop"
  exit 1
fi

echo "▶ 在 $SRC 构建 Flutter Web（release）..."
( cd "$SRC" && flutter pub get && flutter build web --release )

echo "▶ 复制 web 产物到 build/web，并预置 hls.js..."
rm -rf "$OUT"
mkdir -p build
cp -r "$SRC/build/web" build/web
curl -fsSL https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js -o build/web/hls.min.js

echo "▶ 构建 nginx 镜像 dramacube-web:local..."
docker build -t dramacube-web:local .

echo "✅ 完成。运行：docker run -p 8080:80 dramacube-web:local  然后访问 http://localhost:8080"
