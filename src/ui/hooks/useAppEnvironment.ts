import { useEffect } from 'react';
import { shouldAutoLock, type ActivityState } from '../../state/lock.ts';
import type { Settings } from '../../engine/types.ts';

/** Puts the mode on the document root, where the --mode tint picks it up. */
export function useModeTint(mode: Settings['mode'] | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (mode) root.setAttribute('data-mode', mode);
    else root.removeAttribute('data-mode');
  }, [mode]);
}

/** Applies the theme setting to the document root. */
export function useTheme(theme: Settings['theme'] | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (!theme || theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}

/** Locks after inactivity or more than 60 s in the background. Only runs while enabled. */
export function useAutoLock(enabled: boolean, lockMinutes: number, onLock: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const state: ActivityState = { lastActivityAt: Date.now() };
    const check = () => {
      if (shouldAutoLock(state, Date.now(), lockMinutes)) onLock();
    };
    const activity = () => {
      state.lastActivityAt = Date.now();
    };
    const visibility = () => {
      if (document.hidden) {
        state.hiddenSince = Date.now();
      } else {
        check();
        delete state.hiddenSince;
        activity();
      }
    };
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, activity, { passive: true }));
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(check, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, activity));
      document.removeEventListener('visibilitychange', visibility);
      window.clearInterval(timer);
    };
  }, [enabled, lockMinutes, onLock]);
}

/** True when running as an installed Home Screen app. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
