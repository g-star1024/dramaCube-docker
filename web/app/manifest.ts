import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DramaCube 剧立方',
    short_name: 'DramaCube',
    description: 'DramaCube 独立 Web 前端：点播、直播、收藏与续播',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0d0c',
    theme_color: '#0f0d0c',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
