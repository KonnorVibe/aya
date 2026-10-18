// Cases carried over from the vergleichskillweb engine tests, plus a rolling accuracy benchmark
// that guards against regressions when the engine changes.
import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from './dates.ts';
import { bbtLogs, mergeLogs, normal, periodLogs, rng } from './fixtures.ts';
import { detectBbtShift } from './ovulation.ts';
import { predict } from './prediction.ts';
import type { DayLog, Settings } from './types.ts';

const track: Pick<Settings, 'mode'> = { mode: 'track' };

describe('stable cycles without an onboarding prior', () => {
  for (const n of [6, 10]) {
    it(`converges on 32 days after ${n} cycles`, () => {
      const { logs, current } = periodLogs('2025-01-06', Array(n).fill(32));
      const p = predict({ logs, settings: track, today: addDays(current, 6) })!;
      expect(diffDays(p.nextPeriod.mostLikely, current)).toBe(32);
    });
  }
});

describe('temperature edge cases', () => {
  it('a disturbed spike only stays harmless when it is flagged', () => {
    const base = bbtLogs('2026-03-01', 24, 15);
    const spike = (disturbed: boolean): DayLog[] =>
      base.map((l, i) => (i === 9 ? { ...l, bbt: { value: 37.3, disturbed } } : l));
    expect(detectBbtShift(spike(true))?.ovulationDate).toBe(detectBbtShift(base)?.ovulationDate);
    expect(detectBbtShift(spike(false))?.ovulationDate).not.toBe(detectBbtShift(base)?.ovulationDate);
  });

  it('narrows the range for irregular cycles once the rise is confirmed', () => {
    const { logs, current } = periodLogs('2025-06-02', [26, 35, 29, 38, 27, 33]);
    const today = addDays(current, 22);
    const before = predict({ logs, settings: track, today })!;
    const withBbt = mergeLogs(logs, bbtLogs(current, 23, 16));
    const after = predict({ logs: withBbt, settings: track, today })!;
    expect(after.basis).toBe('bbt');
    const width = (r: { earliest: string; latest: string }) => diffDays(r.latest, r.earliest);
    expect(width(after.nextPeriod)).toBeLessThan(width(before.nextPeriod));
  });
});

describe('rolling accuracy benchmark', () => {
  // After each logged period (from the 4th on), predict the next start and compare.
  function rolling(mean: number, sd: number) {
    let abs = 0, hits = 0, n = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const r = rng(seed * 7919);
      const lengths = Array.from({ length: 40 }, () => Math.round(Math.min(60, Math.max(18, normal(r, mean, sd)))));
      const { logs } = periodLogs('2023-01-02', lengths);
      let start = '2023-01-02';
      const starts = [start];
      for (const l of lengths) starts.push((start = addDays(start, l)));
      for (let i = 3; i < starts.length - 1; i++) {
        const past = logs.filter((l) => l.date <= addDays(starts[i]!, 6));
        const p = predict({ logs: past, settings: track, today: addDays(starts[i]!, 6) })!;
        const actual = starts[i + 1]!;
        abs += Math.abs(diffDays(p.nextPeriod.mostLikely, actual));
        if (actual >= p.nextPeriod.earliest && actual <= p.nextPeriod.latest) hits++;
        n++;
      }
    }
    return { mae: abs / n, coverage: hits / n };
  }

  it('regular cycles N(29, 2): error under 2 days, 80 % range holds', () => {
    const { mae, coverage } = rolling(29, 2);
    expect(mae).toBeLessThan(2);
    expect(coverage).toBeGreaterThan(0.75);
    expect(coverage).toBeLessThan(0.9);
  });

  it('irregular cycles N(32, 6): error under 5.5 days, range stays honest', () => {
    const { mae, coverage } = rolling(32, 6);
    expect(mae).toBeLessThan(5.5);
    expect(coverage).toBeGreaterThan(0.7);
  });
});
