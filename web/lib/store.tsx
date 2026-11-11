'use client';

// 本地状态层（移植自 Flutter web_store.dart 的 WebStore / WebState）。
// 使用 React Context + localStorage 持久化，键名与序列化结构与 Flutter 完全一致，
// 同源部署时两套 Web 前端可共享收藏/历史/网关设置。内置演示片库常驻，无需开关。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Drama, HistoryItem } from './types';

const K = {
  gateway: 'dramacube.web.gateway',
  favorites: 'dramacube.web.favorites',
  history: 'dramacube.web.history',
  searches: 'dramacube.web.searches',
  favSites: 'dramacube.web.favSites',
  histSites: 'dramacube.web.histSites',
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 配额或隐私模式，忽略 */
  }
}

export interface StoreState {
  gateway: string;
  favorites: Drama[];
  history: HistoryItem[];
  searches: string[];
  navIndex: number;
  hasGateway: boolean;
  isFavorite: (id: string) => boolean;
  setGateway: (v: string) => void;
  toggleFavorite: (d: Drama, site?: string) => void;
  addHistory: (
    d: Drama,
    episodeIndex: number,
    episodeTitle: string,
    playURL: string,
    site?: string,
  ) => void;
  removeHistory: (dramaId: string) => void;
  clearHistory: () => void;
  addSearch: (w: string) => void;
  clearSearches: () => void;
  clearUserData: () => void;
  setNavIndex: (i: number) => void;
  siteOfFavorite: (id: string) => string | undefined;
  siteOfHistory: (id: string) => string | undefined;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [gateway, setGatewayState] = useState('');
  const [favorites, setFavorites] = useState<Drama[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searches, setSearches] = useState<string[]>([]);
  const [favSites, setFavSites] = useState<Record<string, string>>({});
  const [histSites, setHistSites] = useState<Record<string, string>>({});
  const [navIndex, setNavIndex] = useState(0);

  // 首次挂载时从 localStorage 水合。
  useEffect(() => {
    setGatewayState(window.localStorage.getItem(K.gateway) ?? '');
    setFavorites(read<Drama[]>(K.favorites, []));
    setHistory(read<HistoryItem[]>(K.history, []));
    setSearches(read<string[]>(K.searches, []));
    setFavSites(read<Record<string, string>>(K.favSites, {}));
    setHistSites(read<Record<string, string>>(K.histSites, {}));
  }, []);

  const setGateway = useCallback((v: string) => {
    const val = v.trim();
    setGatewayState(val);
    if (val) window.localStorage.setItem(K.gateway, val);
    else window.localStorage.removeItem(K.gateway);
  }, []);

  const isFavorite = useCallback((id: string) => favorites.some((e) => e.id === id), [favorites]);

  const toggleFavorite = useCallback((d: Drama, site?: string) => {
    setFavorites((prev) => {
      const exists = prev.some((e) => e.id === d.id);
      const next = exists ? prev.filter((e) => e.id !== d.id) : [d, ...prev];
      write(K.favorites, next);
      if (!exists && site) {
        setFavSites((m) => {
          const nm = { ...m, [d.id]: site };
          write(K.favSites, nm);
          return nm;
        });
      } else if (exists) {
        setFavSites((m) => {
          const nm = { ...m };
          delete nm[d.id];
          write(K.favSites, nm);
          return nm;
        });
      }
      return next;
    });
  }, []);

  const addHistory = useCallback(
    (d: Drama, episodeIndex: number, episodeTitle: string, playURL: string, site?: string) => {
      setHistory((prev) => {
        const next = [
          {
            drama: d,
            episodeIndex,
            episodeTitle,
            playURL,
            at: Date.now(),
          },
          ...prev.filter((e) => e.drama.id !== d.id),
        ].slice(0, 40);
        write(K.history, next);
        if (site) {
          setHistSites((m) => {
            const nm = { ...m, [d.id]: site };
            write(K.histSites, nm);
            return nm;
          });
        }
        return next;
      });
    },
    [],
  );

  const removeHistory = useCallback((dramaId: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.drama.id !== dramaId);
      write(K.history, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setHistSites({});
    window.localStorage.removeItem(K.history);
    window.localStorage.removeItem(K.histSites);
  }, []);

  const addSearch = useCallback((w: string) => {
    const word = w.trim();
    if (!word) return;
    setSearches((prev) => {
      const next = [word, ...prev.filter((e) => e !== word)].slice(0, 12);
      write(K.searches, next);
      return next;
    });
  }, []);

  const clearSearches = useCallback(() => {
    setSearches([]);
    window.localStorage.removeItem(K.searches);
  }, []);

  const clearUserData = useCallback(() => {
    window.localStorage.removeItem(K.favorites);
    window.localStorage.removeItem(K.history);
    window.localStorage.removeItem(K.searches);
    window.localStorage.removeItem(K.favSites);
    window.localStorage.removeItem(K.histSites);
    setFavorites([]);
    setHistory([]);
    setSearches([]);
    setFavSites({});
    setHistSites({});
  }, []);

  const siteOfFavorite = useCallback((id: string) => favSites[id], [favSites]);
  const siteOfHistory = useCallback((id: string) => histSites[id], [histSites]);

  const value = useMemo<StoreState>(
    () => ({
      gateway,
      favorites,
      history,
      searches,
      navIndex,
      hasGateway: gateway.trim().length > 0,
      isFavorite,
      setGateway,
      toggleFavorite,
      addHistory,
      removeHistory,
      clearHistory,
      addSearch,
      clearSearches,
      clearUserData,
      setNavIndex,
      siteOfFavorite,
      siteOfHistory,
    }),
    [
      gateway,
      favorites,
      history,
      searches,
      navIndex,
      isFavorite,
      setGateway,
      toggleFavorite,
      addHistory,
      removeHistory,
      clearHistory,
      addSearch,
      clearSearches,
      clearUserData,
      siteOfFavorite,
      siteOfHistory,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
