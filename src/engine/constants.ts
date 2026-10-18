/**
 * Scientific constants. Each value cites its source; change only with a new source.
 */

/** Bull et al., npj Digital Medicine 2019 (~612k ovulatory cycles): mean cycle length. */
export const POPULATION_CYCLE_LENGTH = 29.3;
/** Default prior when the user gave no cycle length (rounded population mean). */
export const DEFAULT_PRIOR_CYCLE_LENGTH = 29;
/** Bull et al. 2019: mean luteal phase length; varies much less than the follicular phase. */
export const DEFAULT_LUTEAL_LENGTH = 12.4;
/** Plausible luteal range used when no personal luteal data exists. */
export const DEFAULT_LUTEAL_RANGE = { min: 11, max: 14 } as const;
/** Prior spread (days) of the luteal phase within one person. */
export const PRIOR_LUTEAL_SD = 1.5;

/** Prior spread (days) for cycle length before personal data dominates. */
export const PRIOR_CYCLE_SD = 3;
/** Bayesian shrinkage strength: prior counts as k cycles. With k=3, personal data dominates from ~6 cycles. */
export const SHRINKAGE_K = 3;
/**
 * Deviation from a fixed k: the prior weight tapers linearly to 0 at this many cycles. With a fixed
 * k = 3 a steady 32-day cycle would be predicted at 31 days forever; tapering keeps the cold-start
 * benefit while letting personal data fully take over from 6 cycles. Spread keeps the full k.
 */
export const PERSONAL_DOMINANCE_CYCLES = 6;
/** Use up to this many recent valid cycles. */
export const MAX_CYCLES_USED = 12;
/** Exponential recency weighting half-life, in cycles. */
export const RECENCY_HALF_LIFE = 6;
/** Scale factor turning MAD into a robust standard deviation estimate (normal consistency). */
export const MAD_TO_SD = 1.4826;
/** Two-sided 80 % normal quantile. */
export const Z_80 = 1.2816;
/** Interval widening when variability exceeds the FIGO limit. */
export const IRREGULAR_WIDENING = 1.25;

/** FIGO 2018: normal cycle length range in days. */
export const FIGO_CYCLE_LENGTH = { min: 24, max: 38 } as const;
/** FIGO 2018: normal period duration up to 8 days. */
export const FIGO_MAX_PERIOD_LENGTH = 8;
/** FIGO 2018: "absent" bleeding after 90 days. */
export const FIGO_ABSENT_DAYS = 90;

/**
 * FIGO 2018 regularity: shortest-to-longest difference. Normal ≤ 7–9 days depending on age
 * (≤ 9 at 18–25, ≤ 7 at 26–41, ≤ 9 at 42–45). Unknown age uses the lenient 9 to avoid false alarms.
 */
export function figoVariabilityLimit(age?: number): number {
  if (age === undefined) return 9;
  return age >= 26 && age <= 41 ? 7 : 9;
}

/** Cycles outside this range are treated as data errors, not physiology. */
export const OUTLIER_CYCLE_LENGTH = { min: 15, max: 90 } as const;
/** Li et al., JAMIA 2022: forgotten periods produce ~double-length cycles. Flag if > 1.6× median and > 45 days. */
export const MISSED_LOG_FACTOR = 1.6;
export const MISSED_LOG_MIN_LENGTH = 45;

/** Bleeding phases separated by fewer than this many bleed-free days are one period. */
export const PERIOD_MERGE_GAP = 3;

/** Wilcox et al., NEJM 1995: fertile window = 5 days before ovulation + ovulation day. */
export const FERTILE_DAYS_BEFORE_OVULATION = 5;
/** Highest conception probability on the 2 days before ovulation and the day itself. */
export const PEAK_DAYS_BEFORE_OVULATION = 2;

/** BBT 3-over-6 rule: 3 readings above the max of the previous 6, the 3rd at least 0.2 °C above. */
export const BBT_BASELINE_COUNT = 6;
export const BBT_HIGH_COUNT = 3;
export const BBT_MIN_RISE = 0.2;

/** Positive LH test: ovulation likely within ~24–36 h, i.e. the following day (range 0–2 days). */
export const LH_TO_OVULATION_DAYS = 1;
/** Extra spread (days) for LH-based ovulation, which is less certain than a BBT shift. */
export const LH_OVULATION_SD = 0.75;

/** Symptom insights: minimum cycles of data and minimum lift over the base rate. */
export const PATTERN_MIN_CYCLES = 3;
export const PATTERN_MIN_LIFT = 1.5;
/** Premenstrual window: last 3 days before the next period. */
export const PREMENSTRUAL_DAYS = 3;
