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
 * Every screen change, tabs included, is one step back: the swipe and "Zurück" always return to the
 * screen one step before, and right after opening nothing happens.
 *
 * In Safari the steps are browser history, so Safari's own back swipe and button work. Installed on
 * the Home Screen they stay in memory instead: iOS there reacts to history on its own (a back swipe
 * reloaded the app and landed on Heute), so aya keeps it out of the browser and handles the swipe
 * from the left edge itself. In history mode going forward again is undone.
 */
export function useNavigation({ memory = isStandalone() }: { memory?: boolean } = {}) {
  const [nav, setNav] = useState<Nav>(START);
  const current = useRef(nav);
  /** Memory mode: the screens before the current one, oldest first. */
  const stack = useRef<Nav[]>([]);
  useLayoutEffect(() => {
    current.current = nav;
  }, [nav]);

  const show = useCallback((next: Nav) => {
    current.current = next;
    setNav(next);
    window.scrollTo?.(0, 0);
  }, []);

  useEffect(() => {
    if (memory) return;
    window.history.replaceState(START, '');
    const pop = (e: PopStateEvent) => {
      const next = (e.state as Nav | null) ?? START;
      if (next.depth > current.current.depth) {
        window.history.back();
        return;
      }
      show(next);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [memory, show]);

  const push = useCallback(
    (next: Omit<Nav, 'depth'>) => {
      const entry = { ...next, depth: current.current.depth + 1 };
      if (memory) stack.current.push(current.current);
      else window.history.pushState(entry, '');
      show(entry);
    },
    [memory, show],
  );

  const back = useCallback(() => {
    if (current.current.depth === 0) return;
    if (!memory) return window.history.back();
    const prev = stack.current.pop();
    if (prev) show(prev);
  }, [memory, show]);

  const selectTab = useCallback(
    (tab: TabId) => {
      const now = current.current;
      if (now.tab === tab && !now.pages.length) return;
      push({ tab, pages: [] });
    },
    [push],
  );

  useEdgeSwipe(memory, back);

  return {
    nav,
    back,
    selectTab,
    openPage: (page: Page) => push({ tab: current.current.tab, pages: [...current.current.pages, page] }),
    /** Opens a page on another tab (e.g. an import source from the settings). */
    openPageOn: (tab: TabId, page: Page) => push({ tab, pages: [page] }),
  };
}

const EDGE = 40;
const DISTANCE = 60;

/**
 * A horizontal swipe that starts near the left edge calls `onBack` once. The page follows the
 * finger a little, so the gesture is visible; it springs back if the swipe is not finished.
 * Off while a sheet or dialog is open.
 */
function useEdgeSwipe(enabled: boolean, onBack: () => void) {
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;
    const page = () => document.querySelector<HTMLElement>('#root > main');
    const reset = () => {
      if (!start) return;
      const el = page();
      if (el) {
        el.style.transition = 'transform 200ms ease-out';
        el.style.transform = '';
      }
      start = null;
    };
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      const open = document.querySelector('dialog[open]');
      start = t && e.touches.length === 1 && t.clientX <= EDGE && !open ? { x: t.clientX, y: t.clientY } : null;
    };
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      if (Math.abs(t.clientY - start.y) > Math.max(dx, 12)) return reset();
      const el = page();
      if (el && dx > 0) {
        el.style.transition = 'none';
        el.style.transform = `translateX(${Math.min(dx, 120) * 0.5}px)`;
      }
      if (dx > DISTANCE) {
        reset();
        onBack();
      }
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', reset);
    window.addEventListener('touchcancel', reset);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', reset);
      window.removeEventListener('touchcancel', reset);
    };
  }, [enabled, onBack]);
}
