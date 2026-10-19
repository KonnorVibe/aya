import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TabId } from '../components/TabBar.tsx';
import type { Panel } from '../screens/Settings.tsx';
import { isStandalone } from './useAppEnvironment.ts';

export type PageId = 'method' | 'learn' | 'import';

export interface Nav {
  tab: TabId;
  /** Long-form pages over the tab; the last one is shown. */
  pages: PageId[];
  /** Settings panel to open right away. */
  panel?: Panel | undefined;
  /** Steps since the app opened; 0 = nothing to go back to. */
  depth: number;
}

const START: Nav = { tab: 'today', pages: [], depth: 0 };

/**
 * Tabs and pages as browser history, so Safari's back swipe and the browser back button go to the
 * screen before. Installed on the Home Screen, iOS offers no back swipe, so a swipe from the left
 * edge does the same there.
 */
export function useNavigation() {
  const [nav, setNav] = useState<Nav>(START);
  const current = useRef(nav);
  useLayoutEffect(() => {
    current.current = nav;
  }, [nav]);

  useEffect(() => {
    window.history.replaceState(START, '');
    const pop = (e: PopStateEvent) => {
      setNav((e.state as Nav | null) ?? START);
      window.scrollTo?.(0, 0);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  const go = useCallback((next: Omit<Nav, 'depth'>) => {
    const entry = { ...next, depth: current.current.depth + 1 };
    window.history.pushState(entry, '');
    current.current = entry;
    setNav(entry);
    window.scrollTo?.(0, 0);
  }, []);

  const back = useCallback(() => {
    if (current.current.depth > 0) window.history.back();
  }, []);

  useEdgeSwipe(isStandalone(), back);

  return {
    nav,
    back,
    selectTab: (tab: TabId) => go({ tab, pages: [] }),
    openPage: (page: PageId) => go({ tab: current.current.tab, pages: [...current.current.pages, page] }),
    openSettings: (panel: Panel) => go({ tab: 'settings', pages: [], panel }),
  };
}

const EDGE = 24;
const DISTANCE = 70;

/** A horizontal swipe that starts at the left edge calls `onBack` once. */
function useEdgeSwipe(enabled: boolean, onBack: () => void) {
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      start = t && e.touches.length === 1 && t.clientX <= EDGE ? { x: t.clientX, y: t.clientY } : null;
    };
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      if (Math.abs(t.clientY - start.y) > dx) start = null;
      else if (dx > DISTANCE) {
        start = null;
        onBack();
      }
    };
    const cancel = () => (start = null);
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', cancel);
    window.addEventListener('touchcancel', cancel);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', cancel);
      window.removeEventListener('touchcancel', cancel);
    };
  }, [enabled, onBack]);
}
