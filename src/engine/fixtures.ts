// Synthetic data for engine tests. Not used by the app.
import { addDays, type ISODate } from './dates.ts';
import type { DayLog } from './types.ts';

/** Seeded PRNG (mulberry32) so "random" test data is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal(rand: () => number, mean: number, sd: number): number {
  const u = 1 - rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Period logs for consecutive cycles of the given lengths, plus the period that opens the ongoing
 * cycle. Returns the logs and the start date of that ongoing cycle.
 */
export function periodLogs(start: ISODate, lengths: readonly number[], periodLength = 5): { logs: DayLog[]; current: ISODate } {
  const logs: DayLog[] = [];
  let day = start;
  const addPeriod = (from: ISODate) => {
    for (let i = 0; i < periodLength; i++) logs.push({ date: addDays(from, i), flow: i === 0 ? 'heavy' : 'medium' });
  };
  for (const len of lengths) {
    addPeriod(day);
    day = addDays(day, len);
  }
  addPeriod(day);
  return { logs, current: day };
}

/** BBT readings: `low` before `shiftDay` (offset from start), `high` from it, with small fixed jitter. */
export function bbtLogs(start: ISODate, days: number, shiftDay: number | null, low = 36.4, high = 36.8): DayLog[] {
  const jitter = [0, 0.05, -0.05, 0.02, -0.03, 0.04, -0.02];
  return Array.from({ length: days }, (_, i) => ({
    date: addDays(start, i),
    bbt: { value: Number(((shiftDay !== null && i >= shiftDay ? high : low) + jitter[i % jitter.length]!).toFixed(2)) },
  }));
}

/** Merges logs for the same date (later entries win per field). */
export function mergeLogs(...groups: DayLog[][]): DayLog[] {
  const map = new Map<ISODate, DayLog>();
  for (const l of groups.flat()) map.set(l.date, { ...map.get(l.date), ...l });
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
