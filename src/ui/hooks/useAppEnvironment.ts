import { useEffect } from 'react';
import { shouldAutoLock, type ActivityState } from '../../state/lock.ts';
import type { Settings } from '../../engine/types.ts';

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

/**
 * Privacy shield: blurs the app as soon as it loses focus or goes to the background, so the iOS
 * app switcher snapshot shows nothing readable.
 */
export function usePrivacyShield(enabled: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      root.removeAttribute('data-shield');
      return;
    }
    const on = () => root.setAttribute('data-shield', '');
    const off = () => {
      if (!document.hidden) root.removeAttribute('data-shield');
    };
    const visibility = () => (document.hidden ? on() : off());
    // iOS fires these in different orders (or only some of them) when the app switcher opens, so
    // the shield goes up on whichever comes first and only comes down once aya is visible again.
    const hide = ['blur', 'pagehide', 'freeze'] as const;
    const show = ['focus', 'pageshow', 'pointerdown'] as const;
    hide.forEach((e) => window.addEventListener(e, on, { capture: true }));
    show.forEach((e) => window.addEventListener(e, off, { capture: true }));
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('freeze', on);
    return () => {
      hide.forEach((e) => window.removeEventListener(e, on, { capture: true }));
      show.forEach((e) => window.removeEventListener(e, off, { capture: true }));
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('freeze', on);
      root.removeAttribute('data-shield');
    };
  }, [enabled]);
}

/** True when running as an installed Home Screen app. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
