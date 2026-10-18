/** Auto-lock policy (only active while a PIN is set). */

/** Lock when the app was in the background longer than this. */
export const BACKGROUND_LOCK_MS = 60_000;

export interface ActivityState {
  lastActivityAt: number;
  hiddenSince?: number;
}

export function shouldAutoLock(state: ActivityState, now: number, lockMinutes: number): boolean {
  if (state.hiddenSince !== undefined && now - state.hiddenSince > BACKGROUND_LOCK_MS) return true;
  return now - state.lastActivityAt > lockMinutes * 60_000;
}
