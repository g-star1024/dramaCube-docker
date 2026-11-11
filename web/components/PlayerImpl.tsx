'use client';

import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

interface Props {
  url: string;
  title?: string;
  poster?: string;
  startTime?: number;
  onError?: (msg: string) => void;
  onTimeUpdate?: (current: number) => void;
}

export default function PlayerImpl({ url, title, poster, startTime, onError, onTimeUpdate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<Artplayer | null>(null);

  useEffect(() => {
    if (!containerRef.current || !url) return;

    const art = new Artplayer({
      container: containerRef.current,
      url,
      title: title ?? '',
      poster,
      volume: 0.8,
      autoplay: false,
      pip: true,
      fullscreen: true,
      playbackRate: true,
      setting: true,
      customType: {
        m3u8: (video: HTMLVideoElement, src: string, art: Artplayer) => {
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(src);
            hls.attachMedia(video);
            (art as unknown as { hls: Hls }).hls = hls;
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (data?.fatal) {
                onError?.('播放出错：' + (data.details || data.type));
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
          } else {
            onError?.('当前浏览器不支持 HLS 播放');
          }
        },
      },
    } as ConstructorParameters<typeof Artplayer>[0]);

    if (startTime && startTime > 0) {
      art.on('ready', () => {
        try {
          (art as unknown as { seek: number }).seek = startTime;
        } catch {
          /* ignore */
        }
      });
    }

    art.on('error', () => onError?.('视频加载失败，请检查地址或网络'));
    art.on('video:timeupdate', () => onTimeUpdate?.(art.video.currentTime));

    artRef.current = art;
    return () => {
      try {
        art.destroy();
      } catch {
        /* ignore */
      }
    };
    // 仅在 url 变化时重建（切集），其余 prop 变化不重建。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div
      ref={containerRef}
      className="w-full aspect-video bg-black rounded-xl2 overflow-hidden"
    />
  );
}
