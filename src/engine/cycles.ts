import {
  MISSED_LOG_FACTOR, MISSED_LOG_MIN_LENGTH, OUTLIER_CYCLE_LENGTH, PERIOD_MERGE_GAP,
} from './constants.ts';
import { addDays, diffDays, type ISODate } from './dates.ts';
import { confirmOvulation } from './ovulation.ts';
import { median } from './stats.ts';
import type { Cycle, CycleOverrides, DayLog, Mode } from './types.ts';

export interface Period {
  start: ISODate;
  end: ISODate;
  length: number;
}

const isBleeding = (l: DayLog) => l.flow === 'light' || l.flow === 'medium' || l.flow === 'heavy';

/**
 * Periods from day logs. A period starts on the first day with at least light flow; spotting
 * alone never starts one. Bleeding phases with fewer than 3 bleed-free days between them merge.
 */
export function derivePeriods(logs: readonly DayLog[]): Period[] {
  const days = logs.filter(isBleeding).map((l) => l.date).sort();
  const periods: Period[] = [];
  for (const day of days) {
    const last = periods[periods.length - 1];
    if (last && diffDays(day, last.end) - 1 < PERIOD_MERGE_GAP) {
      if (day > last.end) last.end = day;
    } else {
      periods.push({ start: day, end: day, length: 1 });
    }
  }
  for (const p of periods) p.length = diffDays(p.end, p.start) + 1;
  return periods;
}

export interface DeriveOptions {
  mode?: Mode;
  overrides?: CycleOverrides;
}

/**
 * Cycles from day logs, oldest first; the last entry is the ongoing cycle (no length).
 * Flags, in this order: outliers (< 15 or > 90 days, data errors), pregnancy (positive test),
 * then likely forgotten periods (> 1.6× personal median and > 45 days, Li et al. JAMIA 2022),
 * which skew predictions and are excluded unless the user chose to include them.
 * Ovulation is confirmed per completed cycle from BBT/LH, except under hormonal contraception.
 */
export function deriveCycles(logs: readonly DayLog[], options: DeriveOptions = {}): Cycle[] {
  const periods = derivePeriods(logs);
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? -1 : 1));

  const cycles: Cycle[] = periods.map((p, i) => {
    const next = periods[i + 1];
    const cycle: Cycle = { startDate: p.start, periodEnd: p.end, periodLength: p.length };
    if (next) {
      cycle.endDate = addDays(next.start, -1);
      cycle.length = diffDays(next.start, p.start);
    }
    return cycle;
  });

  const logsIn = (c: Cycle) =>
    sorted.filter((l) => l.date >= c.startDate && (c.endDate === undefined || l.date <= c.endDate));

  for (const c of cycles) {
    if (c.length === undefined) continue;
    const own = logsIn(c);
    if (c.length < OUTLIER_CYCLE_LENGTH.min || c.length > OUTLIER_CYCLE_LENGTH.max) {
      c.excluded = { reason: 'outlier' };
    } else if (own.some((l) => l.pregnancyTest === 'positive')) {
      c.excluded = { reason: 'pregnancy' };
    }
    if (options.mode !== 'hormonal_contraception') {
      const ov = confirmOvulation(own);
      if (ov && ov.date > c.startDate) {
        c.ovulationDate = ov.date;
        c.ovulationSource = ov.source;
        c.lutealLength = diffDays(addDays(c.endDate!, 1), ov.date);
      }
    }
  }

  const typical = median(cycles.filter((c) => c.length !== undefined && !c.excluded).map((c) => c.length!));
  for (const c of cycles) {
    if (c.length === undefined || c.excluded || Number.isNaN(typical)) continue;
    if (c.length > MISSED_LOG_FACTOR * typical && c.length > MISSED_LOG_MIN_LENGTH) {
      c.excluded = { reason: 'possible_missed_log' };
    }
  }

  for (const c of cycles) {
    if (c.length === undefined) continue;
    if (options.overrides?.exclude?.has(c.startDate)) c.excluded = { reason: 'user' };
    else if (options.overrides?.include?.has(c.startDate) && c.excluded?.reason === 'possible_missed_log') {
      delete c.excluded;
    }
  }
  return cycles;
}

/** Bleeding may pause this many days without the period counting as over. */
const OPEN_PERIOD_GAP = 2;
/** A period is never treated as ongoing beyond this many days. */
const OPEN_PERIOD_MAX_DAYS = 10;

/**
 * The period running today, if any: it started at most 10 days ago, bleeding was logged within the
 * last 2 days, and the user has not marked it as ended before today. Lets the Today screen say
 * "Tag 3 deiner Periode" while only the first day has been logged.
 */
export function openPeriod(logs: readonly DayLog[], today: ISODate): { start: ISODate; day: number } | null {
  const last = derivePeriods(logs.filter((l) => l.date <= today)).at(-1);
  if (!last) return null;
  const day = diffDays(today, last.start) + 1;
  if (day > OPEN_PERIOD_MAX_DAYS) return null;
  const endMark = logs.find((l) => l.periodEnd && l.date >= last.start && l.date <= today);
  if (endMark) return today <= endMark.date ? { start: last.start, day } : null;
  return diffDays(today, last.end) <= OPEN_PERIOD_GAP ? { start: last.start, day } : null;
}

/** Completed cycles usable for statistics (not excluded), oldest first. */
export function validCycles(cycles: readonly Cycle[]): Cycle[] {
  return cycles.filter((c) => c.length !== undefined && !c.excluded);
}
