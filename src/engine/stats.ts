/** Small robust-statistics helpers for the prediction engine. */

export function median(values: readonly number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Weighted median: robust against outliers (unlike the mean) while letting recent cycles count more.
 * Averages the two middle values when the cumulative weight hits exactly one half.
 */
export function weightedMedian(values: readonly number[], weights: readonly number[]): number {
  if (!values.length) return NaN;
  const pairs = values.map((v, i) => [v, weights[i] ?? 0] as const).sort((a, b) => a[0] - b[0]);
  const half = pairs.reduce((s, p) => s + p[1], 0) / 2;
  let acc = 0;
  for (let i = 0; i < pairs.length; i++) {
    acc += pairs[i]![1];
    if (Math.abs(acc - half) < 1e-9 && i + 1 < pairs.length) return (pairs[i]![0] + pairs[i + 1]![0]) / 2;
    if (acc > half) return pairs[i]![0];
  }
  return pairs[pairs.length - 1]![0];
}

/** Median absolute deviation. */
export function mad(values: readonly number[]): number {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/** Exponential recency weights, ordered oldest → newest (newest gets weight 1). */
export function recencyWeights(count: number, halfLife: number): number[] {
  return Array.from({ length: count }, (_, i) => 0.5 ** ((count - 1 - i) / halfLife));
}

/** Bayesian shrinkage: (n·personal + k·prior) / (n + k). */
export function shrink(personal: number, n: number, prior: number, k: number): number {
  return n > 0 ? (n * personal + k * prior) / (n + k) : prior;
}

/** Prior weight for the mean: k, tapering linearly to 0 at `dominance` personal cycles. */
export function taperedK(n: number, k: number, dominance: number): number {
  return k * Math.max(0, 1 - n / dominance);
}
