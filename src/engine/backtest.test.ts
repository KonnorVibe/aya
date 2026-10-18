import { describe, expect, it } from 'vitest';
import { backtest } from './backtest.ts';
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
});
