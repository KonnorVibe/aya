import { validCycles } from './cycles.ts';
import { estimateCycleLength, interval80 } from './prediction.ts';
import type { ISODate } from './dates.ts';
import type { Cycle } from './types.ts';

export interface BacktestResult {
  /** Number of predictions evaluated. */
  n: number;
  /** Mean absolute error of the most likely day, in days. */
  mae: number;
  /** Share of actual starts inside the 80 % interval (0–1). */
  coverage: number;
  /** One entry per predicted cycle, oldest first: how far off the most likely day was. */
  steps: BacktestStep[];
}

export interface BacktestStep {
  /** Start of the predicted cycle. */
  start: ISODate;
  /** Actual minus predicted length in days: positive = the period came later. */
  error: number;
  /** The actual start fell inside the shown range. */
  hit: boolean;
}

/** How the error developed: the first predictions against the latest ones. Needs 4 steps. */
export function accuracyTrend(steps: readonly BacktestStep[]): { early: number; recent: number; count: number } | null {
  if (steps.length < 4) return null;
  const count = Math.min(3, Math.floor(steps.length / 2));
  const mean = (xs: readonly BacktestStep[]) => xs.reduce((sum, x) => sum + Math.abs(x.error), 0) / xs.length;
  return { early: mean(steps.slice(0, count)), recent: mean(steps.slice(-count)), count };
}

/**
 * Honest quality check: for every valid cycle from the third on, predict its length using only the
 * cycles before it, then compare with what actually happened. Returns null with < 3 valid cycles.
 */
export function backtest(cycles: readonly Cycle[], opts: { prior?: number; age?: number } = {}): BacktestResult | null {
  const valid = validCycles(cycles);
  const lengths = valid.map((c) => c.length!);
  const steps: BacktestStep[] = [];
  for (let i = 2; i < lengths.length; i++) {
    const est = estimateCycleLength(lengths.slice(0, i), opts);
    const r = interval80(est.mean, est.sd, est.irregular);
    const actual = lengths[i]!;
    steps.push({ start: valid[i]!.startDate, error: actual - r.mostLikely, hit: actual >= r.earliest && actual <= r.latest });
  }
  const n = steps.length;
  if (!n) return null;
  return {
    n,
    mae: steps.reduce((sum, x) => sum + Math.abs(x.error), 0) / n,
    coverage: steps.filter((x) => x.hit).length / n,
    steps,
  };
}
