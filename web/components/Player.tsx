'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const PlayerImpl = dynamic(() => import('./PlayerImpl'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-video bg-black rounded-xl2 grid place-items-center text-ink-dim">
      播放器加载中…
    </div>
  ),
});

type Props = ComponentProps<typeof PlayerImpl>;

export default function Player(props: Props) {
  return <PlayerImpl {...props} />;
}
