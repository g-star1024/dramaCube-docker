#!/usr/bin/env python3
"""生成 Flutter Web 引擎字体回退的本地离线包（一次性工具）。

背景
----
`--no-web-resources-cdn` 只本地化 canvaskit，不覆盖字体：引擎在
`font_fallbacks.dart` 里把缺字回退到 `https://fonts.gstatic.com/s/`，
实测每打开一次页面就固定请求 1 个 Roboto + 12 个 Noto Sans SC 分片。
纯内网 / NAS 部署时这些请求全部失败，中文只能靠系统字体兜底。

本脚本从 Flutter Web SDK 的 `font_fallback_data.dart` 精确取出
`notosanssc/v37/*` 全部 101 个分片（引擎只会请求清单里的 URL），
外加 Roboto 默认字体，下载后打包成 `vendor/font-fallback.tar.gz`。
构建时由 `scripts/prepare_web_output.py` 解压到产物 `fonts/fallback/`，
并把 `fontFallbackBaseUrl` 指过去，实现 0 外链。

产物已随仓库提交，CI / 离线构建不需要联网，也不需要 Flutter SDK。
只有在升级 Flutter SDK（字体分片版本变化）时才需要重跑本脚本。

用法：python3 scripts/fetch_font_fallbacks.py [--sdk /path/to/flutter_web_sdk]
"""

from __future__ import annotations

import argparse
import concurrent.futures
import os
import re
import shutil
import tarfile
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor"
URLS_FILE = VENDOR / "font-urls.txt"
TARBALL = VENDOR / "font-fallback.tar.gz"
BASE = "https://fonts.gstatic.com/s/"
ROBOTO = "roboto/v32/KFOmCnqEu92Fr1Me4GZLCzYlKw.woff2"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def sdk_candidates() -> list[Path]:
    out = []
    env = os.environ.get("FLUTTER_ROOT")
    if env:
        out.append(Path(env) / "bin/cache/flutter_web_sdk")
    out.append(Path.home() / "development/flutter/bin/cache/flutter_web_sdk")
    out.append(Path.home() / "flutter/bin/cache/flutter_web_sdk")
    return out


def collect_urls(explicit: str | None) -> list[str]:
    data_file = None
    if explicit:
        p = Path(explicit) / "lib/_engine/engine/font_fallback_data.dart"
        if p.is_file():
            data_file = p
    if data_file is None:
        for sdk in sdk_candidates():
            p = sdk / "lib/_engine/engine/font_fallback_data.dart"
            if p.is_file():
                data_file = p
                break
    if data_file is None:
        # 无 SDK：使用上次生成时保存的清单（离线可复现）
        if not URLS_FILE.is_file():
            raise SystemExit("找不到 Flutter Web SDK，也没有 vendor/font-urls.txt")
        return [ln.strip() for ln in URLS_FILE.read_text().splitlines() if ln.strip()]

    text = data_file.read_text(encoding="utf-8")
    urls = re.findall(r"'([^']+\.woff2)'", text)
    # 简体中文分片（含 2 个无编号的兜底分片）+ Roboto 默认字体
    picked = [u for u in urls if u.startswith("notosanssc/")]
    picked.append(ROBOTO)
    # 去重保序
    seen: set[str] = set()
    result = []
    for u in picked:
        if u not in seen:
            seen.add(u)
            result.append(u)
    print(f"SDK: {data_file}")
    print(f"清单：{len(result)} 个字体文件（notosanssc {len(picked) - 1} + Roboto 1）")
    return result


def download(url: str, dest: Path) -> tuple[str, int, str]:
    target = dest / url
    target.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(BASE + url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = resp.read()
        if not payload.startswith(b"wOF2"):
            return url, 0, "不是合法 woff2"
        target.write_bytes(payload)
        return url, len(payload), ""
    except Exception as exc:  # noqa: BLE001
        return url, 0, str(exc)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sdk", help="flutter_web_sdk 目录（可选）")
    args = ap.parse_args()

    VENDOR.mkdir(parents=True, exist_ok=True)
    urls = collect_urls(args.sdk)
    URLS_FILE.write_text("\n".join(urls) + "\n", encoding="utf-8")

    with tempfile.TemporaryDirectory(prefix="dc-fonts-") as tmp:
        dest = Path(tmp) / "fonts/fallback"
        dest.mkdir(parents=True)
        failed = []
        total = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            futures = [pool.submit(download, u, dest) for u in urls]
            for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
                url, size, err = fut.result()
                if err:
                    failed.append((url, err))
                else:
                    total += size
                if i % 25 == 0:
                    print(f"  已处理 {i}/{len(urls)}")
        if failed:
            for url, err in failed[:10]:
                print(f"  ✗ {url}: {err}")
            raise SystemExit(f"下载失败 {len(failed)} 个，终止（避免生成不完整离线包）")
        print(f"下载完成：{len(urls)} 个文件，合计 {total / 1024 / 1024:.2f} MiB")
        tmp_tar = TARBALL.with_suffix(".tmp")
        with tarfile.open(tmp_tar, "w:gz", compresslevel=9) as tar:
            tar.add(dest.parent, arcname="fonts")
        tmp_tar.replace(TARBALL)
    print(f"已生成 {TARBALL.relative_to(ROOT)} ({TARBALL.stat().st_size / 1024 / 1024:.2f} MiB)")
    print("清单已保存到 vendor/font-urls.txt；提交这两个文件即可让 CI 完全离线。")


if __name__ == "__main__":
    main()
