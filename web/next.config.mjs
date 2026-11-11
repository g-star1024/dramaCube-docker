/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 构建时不以 ESLint 阻断（类型检查仍生效）；可单独运行 next lint。
  eslint: { ignoreDuringBuilds: true },
  // 浏览器直连网关容器：同源 /api/* 反代到 GATEWAY_URL（与 Flutter Web 的 nginx 行为对齐）。
  // 构建期若未设置 GATEWAY_URL，则回退到同源占位（本地 dev 时由 next dev 代理或用户设置网关地址）。
  async rewrites() {
    const gateway = process.env.GATEWAY_URL || 'http://localhost:8080';
    return [
      {
        source: '/api/:path*',
        destination: `${gateway.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
