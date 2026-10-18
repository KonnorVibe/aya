import { validCycles } from './cycles.ts';
import { estimateCycleLength, interval80 } from './prediction.ts';
import type { Cycle } from './types.ts';

export interface BacktestResult {
  /** Number of predictions evaluated. */
  n: number;
  /** Mean absolute error of the most likely day, in days. */
  mae: number;
  /** Share of actual starts inside the 80 % interval (0–1). */
  coverage: number;
}

/**
 * Honest quality check: for every valid cycle from the third on, predict its length using only the
 * cycles before it, then compare with what actually happened. Returns null with < 3 valid cycles.
 */
export function backtest(cycles: readonly Cycle[], opts: { prior?: number; age?: number } = {}): BacktestResult | null {
  const lengths = validCycles(cycles).map((c) => c.length!);
  let n = 0;
  let absError = 0;
  let hits = 0;
  for (let i = 2; i < lengths.length; i++) {
    const est = estimateCycleLength(lengths.slice(0, i), opts);
    const r = interval80(est.mean, est.sd, est.irregular);
    const actual = lengths[i]!;
    n++;
    absError += Math.abs(actual - r.mostLikely);
    if (actual >= r.earliest && actual <= r.latest) hits++;
  }
  return n ? { n, mae: absError / n, coverage: hits / n } : null;
}
