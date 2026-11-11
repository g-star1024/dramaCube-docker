'use client';

import { StoreProvider } from '@/lib/store';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
