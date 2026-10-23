import { describe, expect, it } from 'vitest';
import { accuracyTrend, backtest } from './backtest.ts';
import { deriveCycles } from './cycles.ts';
import { normal, periodLogs, rng } from './fixtures.ts';

describe('backtest', () => {
  it('needs at least 3 valid cycles', () => {
    expect(backtest(deriveCycles(periodLogs('2026-01-01', [28, 28]).logs))).toBeNull();
  });

  it('is exact for perfectly regular cycles', () => {
    const result = backtest(deriveCycles(periodLogs('2025-01-01', Array(12).fill(28)).logs))!;
    expect(result.mae).toBeLessThan(0.5);
    expect(result.coverage).toBe(1);
  });

  it('keeps the 80 % interval calibrated (70–90 % hits) on realistic synthetic data', () => {
    const coverages: number[] = [];
    const maes: number[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const rand = rng(seed);
      const lengths = Array.from({ length: 40 }, () => Math.round(normal(rand, 29, 2)));
      const result = backtest(deriveCycles(periodLogs('2020-01-01', lengths).logs))!;
      coverages.push(result.coverage);
      maes.push(result.mae);
    }
    const coverage = coverages.reduce((a, b) => a + b) / coverages.length;
    const mae = maes.reduce((a, b) => a + b) / maes.length;
    expect(coverage).toBeGreaterThanOrEqual(0.7);
    expect(coverage).toBeLessThanOrEqual(0.9);
    expect(mae).toBeGreaterThanOrEqual(1);
    expect(mae).toBeLessThanOrEqual(3);
  });

  it('lists every predicted cycle with its signed error', () => {
    // 28-day cycles, then one 32: the last prediction is 4 days early.
    const result = backtest(deriveCycles(periodLogs('2025-01-01', [28, 28, 28, 28, 32]).logs))!;
    expect(result.steps).toHaveLength(3);
    expect(result.steps.at(-1)!.error).toBeGreaterThan(2);
    expect(result.n).toBe(result.steps.length);
  });
});

describe('accuracyTrend', () => {
  const step = (error: number) => ({ start: '2026-01-01', error, hit: Math.abs(error) <= 2 });
  it('compares the first predictions with the latest', () => {
    expect(accuracyTrend([step(4), step(-3), step(1), step(0), step(1), step(-1)])).toEqual({ early: 8 / 3, recent: 2 / 3, count: 3 });
    expect(accuracyTrend([step(4), step(2), step(0), step(1)])).toEqual({ early: 3, recent: 0.5, count: 2 });
  });
  it('needs four predictions', () => {
    expect(accuracyTrend([step(1), step(2), step(3)])).toBeNull();
  });
});
