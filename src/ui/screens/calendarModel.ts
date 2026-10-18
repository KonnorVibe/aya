import { deriveCycles, validCycles } from '../../engine/cycles.ts';
import { addDays, type ISODate } from '../../engine/dates.ts';
import { fertilityLevel, upcomingPeriods, type Prediction } from '../../engine/prediction.ts';
import { median } from '../../engine/stats.ts';
import type { DayLog, Settings } from '../../engine/types.ts';

export interface CalendarDay {
  date: ISODate;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  future: boolean;
  /** Logged bleeding (light or more) or a forecast period day. */
  period: 'logged' | 'spotting' | 'predicted' | null;
  fertility: 'peak' | 'high' | null;
  ovulation: boolean;
  /** Anything besides bleeding was logged. */
  hasEntry: boolean;
}

const FUTURE_PERIODS = 6;
const BLEEDING_KEYS = new Set(['date', 'flow', 'periodEnd']);

/** Expected period length: personal median, else the onboarding answer, else 5 days. */
export function expectedPeriodLength(logs: readonly DayLog[], settings: Pick<Settings, 'defaultPeriodLength'>): number {
  const lengths = validCycles(deriveCycles(logs)).map((c) => c.periodLength);
  return Math.round(lengths.length ? median(lengths) : (settings.defaultPeriodLength ?? 5));
}

/** Forecast period days, starting at each predicted most-likely start. */
export function predictedPeriodDays(prediction: Prediction | null, periodLength: number, today: ISODate): Set<ISODate> {
  const days = new Set<ISODate>();
  if (!prediction) return days;
  for (const range of upcomingPeriods(prediction, FUTURE_PERIODS)) {
    for (let i = 0; i < periodLength; i++) {
      const d = addDays(range.mostLikely, i);
      if (d > today) days.add(d);
    }
  }
  return days;
}

/** Monday-first weeks covering the month of `year`/`month` (1–12). */
export function calendarMonth(
  year: number,
  month: number,
  logs: readonly DayLog[],
  prediction: Prediction | null,
  predicted: ReadonlySet<ISODate>,
  today: ISODate,
): CalendarDay[][] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(first, -weekday);
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const ov = prediction?.ovulation?.mostLikely;

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const log = byDate.get(date);
      const bleeding = log?.flow && log.flow !== 'spotting';
      const level = prediction ? fertilityLevel(date, prediction) : 'none';
      week.push({
        date,
        day: Number(date.slice(8)),
        inMonth: date.slice(0, 7) === first.slice(0, 7),
        isToday: date === today,
        future: date > today,
        period: bleeding ? 'logged' : log?.flow === 'spotting' ? 'spotting' : predicted.has(date) ? 'predicted' : null,
        fertility: level === 'none' || bleeding ? null : level,
        ovulation: date === ov,
        hasEntry: !!log && Object.keys(log).some((k) => !BLEEDING_KEYS.has(k)),
      });
    }
    // Drop a trailing week that lies entirely in the next month.
    if (w > 3 && week.every((c) => !c.inMonth)) break;
    weeks.push(week);
  }
  return weeks;
}

/** Months between two dates, for the month navigation bounds. */
export function monthIndex(date: ISODate): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}

export function fromMonthIndex(index: number): { year: number; month: number } {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
