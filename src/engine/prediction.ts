import {
  DEFAULT_LUTEAL_LENGTH, DEFAULT_LUTEAL_RANGE, DEFAULT_PRIOR_CYCLE_LENGTH, FERTILE_DAYS_BEFORE_OVULATION,
  IRREGULAR_WIDENING, LH_OVULATION_SD, MAD_TO_SD, MAX_CYCLES_USED, PEAK_DAYS_BEFORE_OVULATION,
  PERSONAL_DOMINANCE_CYCLES, PRIOR_CYCLE_SD, PRIOR_LUTEAL_SD, RECENCY_HALF_LIFE, SHRINKAGE_K, Z_80, figoVariabilityLimit,
} from './constants.ts';
import { deriveCycles, openPeriod, validCycles } from './cycles.ts';
import { addDays, diffDays, type ISODate } from './dates.ts';
import { confirmOvulation } from './ovulation.ts';
import { mad, median, recencyWeights, shrink, taperedK, weightedMedian } from './stats.ts';
import type { Cycle, CycleOverrides, DayLog, OvulationSource, Settings } from './types.ts';

export interface LengthEstimate {
  /** Expected cycle length in days (fractional). */
  mean: number;
  /** Predictive spread in days. */
  sd: number;
  /** Number of personal cycles used. */
  n: number;
  /** Shortest-to-longest difference exceeds the FIGO limit. */
  irregular: boolean;
}

/**
 * Cycle length estimate from recent valid cycle lengths (oldest first).
 * Recency-weighted median (half-life 6 cycles) is robust to single odd cycles; Bayesian shrinkage
 * towards the prior (user's onboarding value or 29 days, k = 3, tapering to 0 at 6 cycles) handles
 * the cold start; from 6 cycles the mean is fully personal. Spread: MAD × 1.4826, shrunk towards a 3-day prior spread.
 */
export function estimateCycleLength(
  lengths: readonly number[],
  opts: { prior?: number; age?: number } = {},
): LengthEstimate {
  const recent = lengths.slice(-MAX_CYCLES_USED);
  const n = recent.length;
  const prior = opts.prior ?? DEFAULT_PRIOR_CYCLE_LENGTH;
  const personal = n ? weightedMedian(recent, recencyWeights(n, RECENCY_HALF_LIFE)) : prior;
  const personalSd = n >= 2 ? mad(recent) * MAD_TO_SD : PRIOR_CYCLE_SD;
  const irregular = n >= 3 && Math.max(...recent) - Math.min(...recent) > figoVariabilityLimit(opts.age);
  return {
    mean: shrink(personal, n, prior, taperedK(n, SHRINKAGE_K, PERSONAL_DOMINANCE_CYCLES)),
    sd: shrink(personalSd, n, PRIOR_CYCLE_SD, SHRINKAGE_K),
    n,
    irregular,
  };
}

/** 80 % interval as rounded day offsets around a fractional mean. */
export function interval80(mean: number, sd: number, irregular = false) {
  const half = Z_80 * sd * (irregular ? IRREGULAR_WIDENING : 1);
  const mostLikely = Math.round(mean);
  return {
    earliest: Math.min(mostLikely, Math.round(mean - half)),
    mostLikely,
    latest: Math.max(mostLikely, Math.round(mean + half)),
  };
}

export interface LutealEstimate {
  mean: number;
  sd: number;
  n: number;
}

/**
 * Personal luteal phase: median of confirmed luteal lengths, shrunk towards 12.4 days
 * (Bull et al. 2019). The luteal phase is far more stable than the follicular phase.
 */
export function estimateLuteal(cycles: readonly Cycle[]): LutealEstimate {
  const values = validCycles(cycles)
    .map((c) => c.lutealLength)
    .filter((l): l is number => l !== undefined && l >= 7 && l <= 20)
    .slice(-MAX_CYCLES_USED);
  const n = values.length;
  return {
    mean: shrink(n ? median(values) : DEFAULT_LUTEAL_LENGTH, n, DEFAULT_LUTEAL_LENGTH, taperedK(n, SHRINKAGE_K, PERSONAL_DOMINANCE_CYCLES)),
    sd: shrink(n >= 2 ? mad(values) * MAD_TO_SD : PRIOR_LUTEAL_SD, n, PRIOR_LUTEAL_SD, SHRINKAGE_K),
    n,
  };
}

export type Confidence = 'low' | 'medium' | 'high';

export interface DateRange {
  earliest: ISODate;
  mostLikely: ISODate;
  latest: ISODate;
}

export interface Prediction {
  cycleStart: ISODate;
  /** 1-based day of the current cycle. */
  cycleDay: number;
  /** Set while today is within the current period. */
  periodDay?: number;
  nextPeriod: DateRange;
  confidence: Confidence;
  /** What the next-period estimate is based on. */
  basis: 'history' | OvulationSource;
  irregular: boolean;
  estimate: LengthEstimate;
  usedCycles: number;
  /** Absent under hormonal contraception. */
  ovulation?: DateRange & { confirmed: boolean; source?: OvulationSource };
  fertileWindow?: { start: ISODate; end: ISODate; peakStart: ISODate; peakEnd: ISODate };
  /** Days past the expected day, set once today is after the end of the range. */
  lateByDays?: number;
  /** Late and unprotected sex was logged in this cycle's fertile window. */
  suggestPregnancyTest: boolean;
}

export interface PredictInput {
  logs: readonly DayLog[];
  settings: Pick<Settings, 'mode' | 'birthYear' | 'defaultCycleLength'>;
  today: ISODate;
  overrides?: CycleOverrides;
}

function confidenceFor(n: number, range: DateRange): Confidence {
  if (n < 3) return 'low';
  return n >= 6 && diffDays(range.latest, range.earliest) <= 4 ? 'high' : 'medium';
}

const shiftRange = (start: ISODate, r: { earliest: number; mostLikely: number; latest: number }): DateRange => ({
  earliest: addDays(start, r.earliest),
  mostLikely: addDays(start, r.mostLikely),
  latest: addDays(start, r.latest),
});

/**
 * Full prediction for today.
 * - Next period from the cycle length estimate (B, C).
 * - Ovulation ≈ next period − personal luteal phase, never fixed at day 14 (D).
 * - Fertile window = 5 days before ovulation + ovulation day (Wilcox 1995), widened by uncertainty.
 * - Once ovulation is confirmed in the current cycle (BBT/LH), the next period becomes
 *   ovulation + luteal phase, which is much tighter.
 * - Late period handling and pregnancy-test suggestion (E).
 * Returns null when no period has been logged yet.
 */
export function predict({ logs, settings, today, overrides }: PredictInput): Prediction | null {
  const past = logs.filter((l) => l.date <= today);
  const cycles = deriveCycles(past, { mode: settings.mode, ...(overrides ? { overrides } : {}) });
  const current = cycles[cycles.length - 1];
  if (!current) return null;

  const age = settings.birthYear ? Number(today.slice(0, 4)) - settings.birthYear : undefined;
  const lengths = validCycles(cycles).map((c) => c.length!);
  const estimate = estimateCycleLength(lengths, {
    ...(settings.defaultCycleLength !== undefined ? { prior: settings.defaultCycleLength } : {}),
    ...(age !== undefined ? { age } : {}),
  });
  const hormonal = settings.mode === 'hormonal_contraception';
  const luteal = estimateLuteal(cycles);
  const start = current.startDate;
  const historyNext = shiftRange(start, interval80(estimate.mean, estimate.sd, estimate.irregular));

  // Ovulation and fertile window from history.
  const lutealRound = Math.round(luteal.mean);
  const lutealLow = luteal.n ? lutealRound - 1 : DEFAULT_LUTEAL_RANGE.min;
  const lutealHigh = luteal.n ? lutealRound + 1 : DEFAULT_LUTEAL_RANGE.max;
  const predictedOv: DateRange = {
    earliest: addDays(historyNext.earliest, -lutealHigh),
    mostLikely: addDays(historyNext.mostLikely, -lutealRound),
    latest: addDays(historyNext.latest, -lutealLow),
  };

  const currentLogs = past.filter((l) => l.date >= start);
  const confirmed = hormonal ? null : confirmOvulation(currentLogs);
  const useConfirmed = confirmed && confirmed.date > start ? confirmed : null;

  let nextPeriod = historyNext;
  let basis: Prediction['basis'] = 'history';
  if (useConfirmed) {
    const extraSd = useConfirmed.source === 'lh' ? LH_OVULATION_SD : 0;
    const sd = Math.hypot(luteal.sd, extraSd);
    const offset = diffDays(useConfirmed.date, start) + luteal.mean;
    nextPeriod = shiftRange(start, interval80(offset, sd));
    basis = useConfirmed.source;
  }

  let ovulation: Prediction['ovulation'];
  let fertileWindow: Prediction['fertileWindow'];
  if (!hormonal) {
    ovulation = useConfirmed
      ? { earliest: useConfirmed.date, mostLikely: useConfirmed.date, latest: useConfirmed.date, confirmed: true, source: useConfirmed.source }
      : { ...predictedOv, confirmed: false };
    fertileWindow = {
      start: addDays(ovulation.earliest, -FERTILE_DAYS_BEFORE_OVULATION),
      end: ovulation.latest,
      peakStart: addDays(ovulation.mostLikely, -PEAK_DAYS_BEFORE_OVULATION),
      peakEnd: ovulation.mostLikely,
    };
  }

  const late = today > nextPeriod.latest;
  const window = fertileWindow;
  const unprotectedInWindow = !!window && currentLogs.some(
    (l) => l.date >= window.start && l.date <= window.end && l.sex?.some((s) => s.protected !== true),
  );

  const cycleDay = diffDays(today, start) + 1;
  const prediction: Prediction = {
    cycleStart: start,
    cycleDay,
    nextPeriod,
    confidence: confidenceFor(estimate.n, nextPeriod),
    basis,
    irregular: estimate.irregular,
    estimate,
    usedCycles: estimate.n,
    suggestPregnancyTest: late && unprotectedInWindow,
  };
  const open = openPeriod(past, today);
  if (open && open.start === start) prediction.periodDay = open.day;
  else if (today <= current.periodEnd) prediction.periodDay = cycleDay;
  if (ovulation) prediction.ovulation = ovulation;
  if (fertileWindow) prediction.fertileWindow = fertileWindow;
  if (late) prediction.lateByDays = diffDays(today, nextPeriod.mostLikely);
  return prediction;
}

/**
 * Future period starts for calendar and .ics export. Spread grows with √k for the k-th cycle ahead,
 * since each future cycle adds its own variability.
 */
export function upcomingPeriods(prediction: Prediction, count: number): DateRange[] {
  const result: DateRange[] = [prediction.nextPeriod];
  const { mean, sd, irregular } = prediction.estimate;
  for (let k = 1; k < count; k++) {
    const r = interval80(mean * k, sd * Math.sqrt(k), irregular);
    result.push(shiftRange(prediction.nextPeriod.mostLikely, r));
  }
  return result;
}

export type FertilityLevel = 'peak' | 'high' | 'none';

/** Visual fertility level for a day: peak on ovulation −2…0, high elsewhere in the window. */
export function fertilityLevel(date: ISODate, prediction: Prediction): FertilityLevel {
  const w = prediction.fertileWindow;
  if (!w || date < w.start || date > w.end) return 'none';
  return date >= w.peakStart && date <= w.peakEnd ? 'peak' : 'high';
}
