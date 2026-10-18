import {
  BBT_BASELINE_COUNT, BBT_HIGH_COUNT, BBT_MIN_RISE, LH_TO_OVULATION_DAYS,
} from './constants.ts';
import { addDays, type ISODate } from './dates.ts';
import type { DayLog, OvulationSource } from './types.ts';

export interface BbtShift {
  /** Day before the first elevated reading. */
  ovulationDate: ISODate;
  firstHighDate: ISODate;
  /** Coverline: highest of the 6 baseline readings. */
  coverline: number;
}

/**
 * BBT 3-over-6 rule (symptothermal method): progesterone after ovulation raises the resting
 * temperature by ~0.2–0.5 °C. Three consecutive readings above the highest of the previous six,
 * the third ≥ 0.2 °C above it, confirm ovulation on the day before the first elevated reading.
 * Readings marked `disturbed` (illness, alcohol, short sleep) are skipped entirely.
 */
export function detectBbtShift(logs: readonly DayLog[]): BbtShift | null {
  const readings = logs
    .filter((l) => l.bbt && !l.bbt.disturbed && Number.isFinite(l.bbt.value))
    .map((l) => ({ date: l.date, value: l.bbt!.value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  for (let i = BBT_BASELINE_COUNT; i + BBT_HIGH_COUNT <= readings.length; i++) {
    const coverline = Math.max(...readings.slice(i - BBT_BASELINE_COUNT, i).map((r) => r.value));
    const highs = readings.slice(i, i + BBT_HIGH_COUNT);
    const allAbove = highs.every((r) => r.value > coverline);
    const lastRise = highs[BBT_HIGH_COUNT - 1]!.value - coverline;
    if (allAbove && lastRise >= BBT_MIN_RISE - 1e-9) {
      const firstHighDate = readings[i]!.date;
      return { ovulationDate: addDays(firstHighDate, -1), firstHighDate, coverline };
    }
  }
  return null;
}

/** First positive or peak LH test → ovulation likely the following day (24–36 h after the surge). */
export function detectLhOvulation(logs: readonly DayLog[]): ISODate | null {
  const first = [...logs]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .find((l) => l.lhTest === 'positive' || l.lhTest === 'peak');
  return first ? addDays(first.date, LH_TO_OVULATION_DAYS) : null;
}

export interface ConfirmedOvulation {
  date: ISODate;
  source: OvulationSource;
  coverline?: number;
}

/**
 * Combines BBT and LH evidence for one cycle's logs. BBT wins for confirmation (it proves the
 * ovulation happened); LH alone still counts, as it is the earlier signal used for prediction.
 */
export function confirmOvulation(logs: readonly DayLog[]): ConfirmedOvulation | null {
  const bbt = detectBbtShift(logs);
  const lh = detectLhOvulation(logs);
  if (bbt) return { date: bbt.ovulationDate, source: lh ? 'bbt+lh' : 'bbt', coverline: bbt.coverline };
  return lh ? { date: lh, source: 'lh' } : null;
}
