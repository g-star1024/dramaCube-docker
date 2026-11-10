#!/usr/bin/env python3
"""生成 Web 专用 pubspec（Q2 决策：构建时临时移除桌面专属依赖）。

用法：
    python3 prepare_web_pubspec.py <源 pubspec.yaml> <输出 pubspec.yaml>

设计要点
--------
* 只处理 ``dependencies:`` 段的顶层依赖，保留注释与其它段落原样，输出仍是合法 YAML。
* **不修改源码仓**：调用方应把工程复制到临时目录后再把输出写到副本里
  （见 build.sh / CI）。源码仓的 pubspec.yaml 永不落盘改动。
* 被移除的依赖仅在桌面/移动编译图中出现；Web 专用入口 main_web.dart 不引用它们。

实测背景（2026-11-10，Flutter 3.35.4 / Dart 3.9.2）
--------------------------------------------------
``flutter build web`` 的真实编译错误来自源码 import 链里的 ``dart:ffi``（磁力下载），
而非 pubspec 依赖不支持 Web——实测 ``X does not support web`` 报错 0 次。
因此本脚本**不是编译通过的必要条件**；它的收益是：
  1) pub get 少下载几十个桌面插件，CI 更快；
  2) 避免桌面插件在 Web 运行时注册时打无意义告警；
  3) 明确表达「Web 版不依赖这些能力」的边界。
若移除后构建异常，build.sh 会自动回退到原始 pubspec 再构建一次。
"""

import sys

# 桌面/移动专属依赖：Web 轻量版用不到。
REMOVE = {
    # 播放器内核（libmpv）——Web 用浏览器 <video> + hls.js
    "media_kit",
    "media_kit_video",
    "media_kit_libs_video",
    # 本地数据库/文件系统
    "drift",
    "drift_flutter",
    "path_provider",
    "path",
    # 桌面凭据 / 通知 / 窗口 / 托盘
    "flutter_secure_storage",
    "local_notifier",
    "window_manager",
    "tray_manager",
    "screen_brightness",
    "screen_retriever",
    # 本地网关（浏览器不能监听端口，Web 版直连网关容器）
    "shelf",
    "shelf_router",
    # 其它桌面链路
    "url_launcher",
    "file_picker",
    "package_info_plus",
    "flutter_staggered_grid_view",
    "cached_network_image",
    "flutter_cache_manager",
    "fast_gbk",
}

# 保留：flutter / cupertino_icons / dio / flutter_riverpod / shared_preferences /
#       go_router / collection 等纯 Dart 或 Web 可用的基础包
#      （Web 入口实际只用 flutter + dio，其余保留是为了不扰动 lock 解析）。


def main() -> int:
    if len(sys.argv) != 3:
        print("用法: prepare_web_pubspec.py <源 pubspec.yaml> <输出 pubspec.yaml>",
              file=sys.stderr)
        return 2

    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as f:
        lines = f.readlines()

    out = []
    in_deps = False
    skipping = False
    removed = []

    for line in lines:
        stripped = line.rstrip("\n")

        # 段落切换：dependencies: 开始，下一个顶层键结束
        if stripped and not stripped[0].isspace() and not stripped.startswith("#"):
            if stripped.split(":", 1)[0].strip() == "dependencies":
                in_deps = True
                skipping = False
            elif in_deps:
                in_deps = False
                skipping = False

        if in_deps:
            indent = len(line) - len(line.lstrip(" "))
            # 顶层依赖（2 空格）：判断是否要移除
            if indent == 2 and ":" in stripped and not stripped.lstrip().startswith("#"):
                key = stripped.strip().split(":", 1)[0].strip()
                if key in REMOVE:
                    skipping = True
                    removed.append(key)
                    continue
                skipping = False
            elif skipping and indent > 2:
                # 该依赖的子配置（如 sdk: / git: / version:）一并跳过
                continue
            elif skipping and (indent == 2 or indent == 0):
                skipping = False

        out.append(line)

    with open(dst, "w", encoding="utf-8") as f:
        f.writelines(out)

    print(f"已生成 Web 专用 pubspec：{dst}")
    print(f"移除 {len(removed)} 个桌面专属依赖：{', '.join(removed)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
