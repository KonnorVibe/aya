import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TabId } from '../components/TabBar.tsx';
import type { ImportSource } from '../screens/ImportPage.tsx';
import { isStandalone } from './useAppEnvironment.ts';

/** Second-level pages over a tab. */
export type Page =
  | { kind: 'method' }
  | { kind: 'import'; source?: ImportSource | undefined }
  | { kind: 'article'; id: string };

export interface Nav {
  tab: TabId;
  /** Pages over the tab; the last one is shown. */
  pages: Page[];
  /** Steps since the app opened; 0 = nothing to go back to. */
  depth: number;
}

const START: Nav = { tab: 'today', pages: [], depth: 0 };

/**
 * Pages as browser history, so Safari's back swipe and the browser back button return to the page
 * before. Switching tabs replaces the entry instead: a tab is a top level, swiping on it does
 * nothing. Going forward again is undone, so a swipe from the right edge never opens a page.
 * Installed on the Home Screen, iOS offers no back swipe, so a swipe from the left edge does it.
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
      const next = (e.state as Nav | null) ?? START;
      if (next.depth > current.current.depth) {
        window.history.back();
        return;
      }
      // On a tab itself there is nowhere to go back to: stay (Safari's swipe has already popped).
      if (!current.current.pages.length) {
        window.history.pushState(current.current, '');
        return;
      }
      current.current = next;
      setNav(next);
      window.scrollTo?.(0, 0);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  const push = useCallback((next: Omit<Nav, 'depth'>) => {
    const entry = { ...next, depth: current.current.depth + 1 };
    window.history.pushState(entry, '');
    current.current = entry;
    setNav(entry);
    window.scrollTo?.(0, 0);
  }, []);

  const back = useCallback(() => {
    if (current.current.pages.length) window.history.back();
  }, []);

  const selectTab = useCallback((tab: TabId) => {
    // Leaving the pages of the old tab: their history entries stay behind but go nowhere new,
    // since a back step lands on a state of lower depth that we simply show.
    const entry = { tab, pages: [], depth: current.current.depth };
    window.history.replaceState(entry, '');
    current.current = entry;
    setNav(entry);
    window.scrollTo?.(0, 0);
  }, []);

  useEdgeSwipe(isStandalone(), back);

  return {
    nav,
    back,
    selectTab,
    openPage: (page: Page) => push({ tab: current.current.tab, pages: [...current.current.pages, page] }),
    /** Opens a page on another tab (e.g. an import source from the settings). */
    openPageOn: (tab: TabId, page: Page) => push({ tab, pages: [page] }),
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
