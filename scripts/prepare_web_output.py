#!/usr/bin/env python3
"""Flutter Web 产物后处理：把部署产物收口成「纯内网、零外链、升级不串版」。

用法：python3 scripts/prepare_web_output.py <build/web> [repo_root]

`flutter build web` 的产物默认还有三处不适合内网镜像：
  1. 引擎字体会从 fonts.gstatic.com 回退下载（--no-web-resources-cdn 不覆盖字体）；
  2. flutter_bootstrap.js 会注册 Service Worker，升级后浏览器可能一直用缓存的旧
     main.dart.js / hls_bridge.js；
  3. 产物里带了一整套 dart2wasm 用的 skwasm 渲染器与调试 symbols（约 15MB），
     而本构建只有 dart2js + canvaskit 一种 build。

本脚本只改【构建产物】，不碰源码仓任何文件；build.sh 与 CI 都调用它，保证一致。
所有离线资源都来自本仓 vendor/，绝不联网，因此 CI 与纯内网构建都能复现。
"""

from __future__ import annotations

import re
import shutil
import sys
import tarfile
from pathlib import Path

REQUIRED = (
    "index.html",
    "main.dart.js",
    "flutter_bootstrap.js",
    "flutter.js",
    "hls_bridge.js",
    "hls.min.js",
)
FONT_BASE = "fonts/fallback/"
CONFIG_SNIPPET = 'config: {"fontFallbackBaseUrl": "%s"}' % FONT_BASE


def sizeof(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def human(n: int) -> str:
    return f"{n / 1024 / 1024:.2f} MiB"


def ensure_hls(out: Path, root: Path) -> None:
    target = out / "hls.min.js"
    if target.is_file() and target.stat().st_size > 100_000:
        print(f"  ✓ hls.min.js 已随源码产物提供（{human(target.stat().st_size)}）")
        return
    vendored = root / "vendor" / "hls.min.js"
    if not vendored.is_file():
        raise SystemExit("✗ 产物缺少 hls.min.js，且 vendor/hls.min.js 不存在（禁止联网兜底）")
    shutil.copyfile(vendored, target)
    print(f"  ✓ 从 vendor/ 补齐 hls.min.js（{human(target.stat().st_size)}）")


def install_fonts(out: Path, root: Path) -> None:
    tarball = root / "vendor" / "font-fallback.tar.gz"
    if not tarball.is_file():
        raise SystemExit(
            "✗ 缺少 vendor/font-fallback.tar.gz；请先运行 scripts/fetch_font_fallbacks.py"
        )
    with tarfile.open(tarball, "r:gz") as tar:
        members = [m for m in tar.getmembers() if m.isfile()]
        bad = [m.name for m in members if m.name.startswith("/") or ".." in m.name.split("/")]
        if bad:
            raise SystemExit(f"✗ 离线字体包含不安全路径：{bad[:3]}")
        # 逐文件写出：不依赖 tar.extractall 的版本相关 filter 行为，路径完全可控。
        for m in members:
            dest = out / m.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            src = tar.extractfile(m)
            if src is None:
                raise SystemExit(f"✗ 无法读取离线字体：{m.name}")
            with src, open(dest, "wb") as fh:
                shutil.copyfileobj(src, fh)
    shards = [
        p for p in (out / FONT_BASE).rglob("*.woff2")
        if p.name != "fallback.woff2"
    ]
    count = len(shards)
    if count < 50:
        raise SystemExit(f"✗ 离线字体数量异常（{count}），离线包可能损坏")
    # nginx 对清单外语言（日文/韩文/emoji）的回退请求落到这个通用分片，
    # 保证纯内网下既无外链也无 404。必须选中文分片，不能选到 Roboto。
    cjk = [p for p in shards if "notosanssc" in str(p)]
    generic = max(cjk or shards, key=lambda p: p.stat().st_size)
    shutil.copyfile(generic, out / FONT_BASE / "fallback.woff2")
    print(
        f"  ✓ 本地化字体回退 {count} 个 woff2（{human(sizeof(out / 'fonts'))}）"
        f"，通用兜底 {generic.name}"
    )


def patch_bootstrap(out: Path) -> None:
    path = out / "flutter_bootstrap.js"
    text = path.read_text(encoding="utf-8")
    # 文件前半段是 flutter.js 的 loader 实现，里面本来就有
    # `load({serviceWorkerSettings: ...})` 的参数解构；真正决定「是否注册 SW」
    # 的是文件末尾那次 _flutter.loader.load({...}) 调用。只处理末尾调用，
    # 否则会把实现代码误判成注册未移除。
    marker = "_flutter.loader.load("
    idx = text.rfind(marker)
    if idx < 0:
        raise SystemExit("✗ flutter_bootstrap.js 结构变化：找不到 loader.load 调用")
    head, tail = text[:idx], text[idx:]

    if FONT_BASE in tail:
        print("  ✓ bootstrap 已处理过（幂等跳过）")
    else:
        patched, n = re.subn(
            r"serviceWorkerSettings:\s*\{[^}]*\}", CONFIG_SNIPPET, tail, count=1
        )
        if n != 1 and re.search(r"config:\s*\{", tail):
            patched = re.sub(
                r"config:\s*\{",
                'config: {"fontFallbackBaseUrl": "%s", ' % FONT_BASE,
                tail,
                count=1,
            )
            n = 1
        if n != 1:
            raise SystemExit("✗ 无法识别 flutter_bootstrap.js 的 load 配置结构")
        tail = patched

    if "serviceWorkerSettings" in tail:
        raise SystemExit("✗ Service Worker 注册仍未移除")
    if FONT_BASE not in tail:
        raise SystemExit("✗ fontFallbackBaseUrl 注入失败")
    path.write_text(head + tail, encoding="utf-8")
    print("  ✓ bootstrap：注销 Service Worker + 字体回退指向本地 fonts/fallback/")

    sw = out / "flutter_service_worker.js"
    if sw.is_file():
        sw.unlink()
        print("  ✓ 删除 flutter_service_worker.js（旧部署的 SW 由 index.html 主动注销）")


def trim_canvaskit(out: Path) -> None:
    """dart2js 构建只会用 canvaskit（full / chromium 两种变体）。"""
    ck = out / "canvaskit"
    if not ck.is_dir():
        return
    removed = 0
    freed = 0
    for f in sorted(ck.rglob("*")):
        if not f.is_file():
            continue
        name = f.name
        if name.startswith("skwasm") or name.endswith(".symbols"):
            freed += f.stat().st_size
            f.unlink()
            removed += 1
    for keep in ("canvaskit.js", "canvaskit.wasm"):
        if not (ck / keep).is_file():
            raise SystemExit(f"✗ 精简后缺少必需渲染器文件 canvaskit/{keep}")
    for d in ck.iterdir():
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()
    print(f"  ✓ 精简 canvaskit：删除 {removed} 个 skwasm/symbols 文件，释放 {human(freed)}")


def align_chromium_variant(out: Path) -> None:
    """chromium 专用变体曾在构建产物中出现 js/wasm 混版：wasm 要求的导入函数
    在 glue 中不存在（LinkError: import "a"/"sd"），Chromium 浏览器每帧抛
    "flutterCanvasKit.PathBuilder is not a constructor"，页面完全不可用
    （2026-11-11 实测）。

    root 变体与 chromium 变体 API 等价、可在 Chromium 中正常工作（本构建已
    真机验证：root 干净初始化 175 个 API 且 PathBuilder 可用），直接用 root
    覆盖 chromium 下两个文件，保证 js/wasm 永远同源。幂等：一致时跳过。
    """
    import hashlib

    ck = out / "canvaskit"
    ch = ck / "chromium"
    if not ch.is_dir():
        return
    for name in ("canvaskit.js", "canvaskit.wasm"):
        src = ck / name
        dst = ch / name
        if not src.is_file():
            raise SystemExit(f"✗ 缺少 {src}，无法对齐 chromium 变体")
        if dst.is_file() and (
            hashlib.sha256(dst.read_bytes()).hexdigest()
            == hashlib.sha256(src.read_bytes()).hexdigest()
        ):
            continue
        shutil.copyfile(src, dst)
        print(f"  ✓ chromium 变体已用 root 对齐：{name}")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("用法：python3 scripts/prepare_web_output.py <build/web> [repo_root]")
    out = Path(sys.argv[1]).resolve()
    root = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent
    if not out.is_dir():
        raise SystemExit(f"✗ 产物目录不存在：{out}")
    missing = [f for f in REQUIRED[:-1] if not (out / f).is_file()]
    if missing:
        raise SystemExit(f"✗ 产物缺少必需文件：{missing}")
    if "gstatic.com" in (out / "index.html").read_text(encoding="utf-8"):
        raise SystemExit("✗ index.html 仍含 gstatic 外链")

    before = sizeof(out)
    print(f"▶ 产物后处理：{out}")
    ensure_hls(out, root)
    install_fonts(out, root)
    patch_bootstrap(out)
    trim_canvaskit(out)
    align_chromium_variant(out)
    after = sizeof(out)
    print(f"✅ 产物就绪：{human(before)} → {human(after)}（含本地字体，0 外部依赖）")


if __name__ == "__main__":
    main()
