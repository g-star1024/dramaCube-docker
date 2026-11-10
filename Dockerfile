# 剧立方 DramaCube — Flutter Web 部署镜像（路线 B）
#
# 纯 nginx 静态托管 Flutter Web 构建产物，镜像基底 nginx:alpine（约 40MB），
# 叠加 web 资源后整体约 100MB 量级，远轻于已废弃的路线 A（noVNC 桌面镜像）。
#
# 重要：本镜像不含任何应用源码。web 产物由 CI（或本地 build.sh）在构建前放入
# build/web 目录，再由本 Dockerfile 拷贝进 nginx。源码仓 hongguo-desktop 永不进入本仓。

FROM nginx:alpine

# 移除默认站点配置，改用自定义 SPA 配置
RUN rm -f /etc/nginx/conf.d/default.conf

# 自定义配置 + Flutter Web 产物（含预置的 hls.min.js）
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY build/web /usr/share/nginx/html

EXPOSE 80

# 健康检查：nginx 能响应根路径即视为就绪
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
