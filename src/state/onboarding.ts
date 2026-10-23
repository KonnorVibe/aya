import { addDays, diffDays, type ISODate } from '../engine/dates.ts';
import type { DayLog, Mode, Settings } from '../engine/types.ts';

export interface OnboardingInput {
  lastPeriodStart?: ISODate;
  cycleLength?: number;
  periodLength?: number;
  mode: Mode;
}

export const DEFAULT_SETTINGS: Settings = { mode: 'track', lockMinutes: 5, theme: 'system' };
const FALLBACK_PERIOD_LENGTH = 5;

/**
 * Turns onboarding answers into settings and the first period's day logs. Only days up to today
 * are logged; the length answers become the priors for the prediction engine.
 */
export function buildOnboarding(input: OnboardingInput, today: ISODate): { settings: Settings; logs: DayLog[] } {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    mode: input.mode,
    ...(input.cycleLength !== undefined ? { defaultCycleLength: input.cycleLength } : {}),
    ...(input.periodLength !== undefined ? { defaultPeriodLength: input.periodLength } : {}),
  };
  const logs: DayLog[] = [];
  const start = input.lastPeriodStart;
  if (start && start <= today) {
    const days = Math.min(input.periodLength ?? FALLBACK_PERIOD_LENGTH, diffDays(today, start) + 1);
    for (let i = 0; i < days; i++) logs.push({ date: addDays(start, i), flow: 'medium' });
  }
  return { settings, logs };
}
