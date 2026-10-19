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

export const SHIELD_IDLE_MS = 15_000;
/** Touches this close to the bottom are the start of the Home Screen swipe. */
const HOME_SWIPE_ZONE = 28;

/**
 * Privacy shield: covers the app after a short idle time and whenever it loses focus. iOS takes the
 * app-switcher snapshot before a web app gets to paint anything on its way to the background, so
 * covering on "hidden" alone comes too late; covering while idle means the last frame is usually
 * already covered. A touch at the very bottom (the start of the swipe home) covers at once, so the
 * frame iOS keeps is the cover. Only a finished tap uncovers it, never the start of a swipe; the tap
 * lands on the cover, not on a button behind it.
 */
export function usePrivacyShield(enabled: boolean, hint: string) {
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      root.removeAttribute('data-shield');
      return;
    }
    document.body.setAttribute('data-shield-hint', hint);
    let timer = 0;
    const on = () => {
      window.clearTimeout(timer);
      root.setAttribute('data-shield', '');
    };
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(on, SHIELD_IDLE_MS);
    };
    const covered = () => root.hasAttribute('data-shield');
    const off = () => {
      if (document.hidden || !covered()) return;
      root.removeAttribute('data-shield');
      arm();
    };
    const down = (e: PointerEvent | TouchEvent) => {
      if (covered()) return;
      const y = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      if (y !== undefined && y >= window.innerHeight - HOME_SWIPE_ZONE) on();
      else arm();
    };
    const visibility = () => (document.hidden ? on() : undefined);
    const hide = ['blur', 'pagehide'] as const;
    const activity = ['keydown', 'scroll', 'touchmove'] as const;
    hide.forEach((e) => window.addEventListener(e, on, { capture: true }));
    activity.forEach((e) => window.addEventListener(e, arm, { capture: true, passive: true }));
    window.addEventListener('touchstart', down, { capture: true, passive: true });
    window.addEventListener('pointerdown', down, { capture: true });
    window.addEventListener('click', off, { capture: true });
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('freeze', on);
    arm();
    return () => {
      window.clearTimeout(timer);
      hide.forEach((e) => window.removeEventListener(e, on, { capture: true }));
      activity.forEach((e) => window.removeEventListener(e, arm, { capture: true }));
      window.removeEventListener('touchstart', down, { capture: true });
      window.removeEventListener('pointerdown', down, { capture: true });
      window.removeEventListener('click', off, { capture: true });
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('freeze', on);
      root.removeAttribute('data-shield');
      document.body.removeAttribute('data-shield-hint');
    };
  }, [enabled, hint]);
}

/** True when running as an installed Home Screen app. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
