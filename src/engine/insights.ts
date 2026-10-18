import {
  DEFAULT_LUTEAL_LENGTH, FERTILE_DAYS_BEFORE_OVULATION, FIGO_ABSENT_DAYS, FIGO_CYCLE_LENGTH,
  FIGO_MAX_PERIOD_LENGTH, PATTERN_MIN_CYCLES, PATTERN_MIN_LIFT, PREMENSTRUAL_DAYS, figoVariabilityLimit,
} from './constants.ts';
import { validCycles } from './cycles.ts';
import { addDays, diffDays, type ISODate } from './dates.ts';
import type { Prediction } from './prediction.ts';
import { median } from './stats.ts';
import type { Cycle, DayLog, SymptomId } from './types.ts';

export type Regularity = 'regular' | 'irregular' | 'unknown';

export interface CycleStats {
  n: number;
  medianLength?: number;
  minLength?: number;
  maxLength?: number;
  /** Shortest-to-longest difference (FIGO regularity measure). */
  variation?: number;
  medianPeriodLength?: number;
  regularity: Regularity;
}

/** Summary statistics over valid completed cycles, with FIGO 2018 regularity (needs ≥ 3 cycles). */
export function cycleStats(cycles: readonly Cycle[], age?: number): CycleStats {
  const valid = validCycles(cycles);
  const lengths = valid.map((c) => c.length!);
  if (!lengths.length) return { n: 0, regularity: 'unknown' };
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  return {
    n: lengths.length,
    medianLength: median(lengths),
    minLength: min,
    maxLength: max,
    variation: max - min,
    medianPeriodLength: median(valid.map((c) => c.periodLength)),
    regularity: lengths.length < 3 ? 'unknown' : max - min > figoVariabilityLimit(age) ? 'irregular' : 'regular',
  };
}

export type HealthNoticeId = 'short_cycles' | 'long_cycles' | 'long_periods' | 'high_variability' | 'absent_period';

/**
 * Gentle "talk to your doctor" notices based on FIGO 2018 limits. Never a diagnosis.
 * Uses the last up to 6 valid cycles; "consistently" means the median is outside the norm.
 */
export function healthNotices(
  cycles: readonly Cycle[],
  logs: readonly DayLog[],
  today: ISODate,
  age?: number,
): HealthNoticeId[] {
  const notices: HealthNoticeId[] = [];
  const recent = validCycles(cycles).slice(-6);
  if (recent.length >= 3) {
    const m = median(recent.map((c) => c.length!));
    if (m < FIGO_CYCLE_LENGTH.min) notices.push('short_cycles');
    if (m > FIGO_CYCLE_LENGTH.max) notices.push('long_cycles');
    const lengths = recent.map((c) => c.length!);
    if (Math.max(...lengths) - Math.min(...lengths) > figoVariabilityLimit(age)) notices.push('high_variability');
  }
  const periods = cycles.filter((c) => c.periodEnd < today).slice(-3);
  if (periods.filter((c) => c.periodLength > FIGO_MAX_PERIOD_LENGTH).length >= 2) notices.push('long_periods');

  const last = cycles[cycles.length - 1];
  if (last && diffDays(today, last.startDate) > FIGO_ABSENT_DAYS) {
    const pregnant = logs.some((l) => l.date >= last.startDate && l.pregnancyTest === 'positive');
    if (!pregnant) notices.push('absent_period');
  }
  return notices;
}

export type Phase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal' | 'premenstrual';
export const PHASES: readonly Phase[] = ['menstruation', 'follicular', 'ovulation', 'luteal', 'premenstrual'];

/**
 * Phase of a cycle day (0-based offset). Priority on overlaps: menstruation > premenstrual >
 * ovulation window (ovulation −5…+1) > follicular / luteal.
 */
export function phaseOf(offset: number, length: number, periodLength: number, ovulationOffset: number): Phase {
  if (offset < periodLength) return 'menstruation';
  if (offset >= length - PREMENSTRUAL_DAYS) return 'premenstrual';
  if (offset >= ovulationOffset - FERTILE_DAYS_BEFORE_OVULATION && offset <= ovulationOffset + 1) return 'ovulation';
  return offset < ovulationOffset ? 'follicular' : 'luteal';
}

export interface SymptomPattern {
  symptom: SymptomId;
  phase: Phase;
  /** Cycles in which the symptom appeared in this phase. */
  cyclesWith: number;
  cyclesTotal: number;
  /** Daily rate in this phase divided by the overall daily rate. */
  lift: number;
}

/**
 * Symptom frequency per cycle phase across completed cycles that contain at least one log.
 * Only reports patterns backed by ≥ 3 cycles, a lift ≥ 1.5 over the base rate, and occurrence in
 * at least half of the cycles, so single coincidences never become "insights".
 */
export function symptomPatterns(logs: readonly DayLog[], cycles: readonly Cycle[]): SymptomPattern[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const usable = validCycles(cycles).filter((c) =>
    logs.some((l) => l.date >= c.startDate && l.date <= c.endDate!),
  );
  if (usable.length < PATTERN_MIN_CYCLES) return [];

  const phaseDays = new Map<Phase, number>();
  let totalDays = 0;
  const symptomDays = new Map<SymptomId, number>();
  const phaseHits = new Map<string, { days: number; cycles: Set<ISODate> }>();

  for (const c of usable) {
    const len = c.length!;
    const ov = c.ovulationDate ? diffDays(c.ovulationDate, c.startDate) : Math.round(len - DEFAULT_LUTEAL_LENGTH);
    for (let o = 0; o < len; o++) {
      const phase = phaseOf(o, len, c.periodLength, ov);
      phaseDays.set(phase, (phaseDays.get(phase) ?? 0) + 1);
      totalDays++;
      for (const s of byDate.get(addDays(c.startDate, o))?.symptoms ?? []) {
        symptomDays.set(s, (symptomDays.get(s) ?? 0) + 1);
        const key = `${s}|${phase}`;
        const hit = phaseHits.get(key) ?? { days: 0, cycles: new Set() };
        hit.days++;
        hit.cycles.add(c.startDate);
        phaseHits.set(key, hit);
      }
    }
  }

  const patterns: SymptomPattern[] = [];
  for (const [key, hit] of phaseHits) {
    const [symptom, phase] = key.split('|') as [SymptomId, Phase];
    const baseRate = symptomDays.get(symptom)! / totalDays;
    const lift = hit.days / phaseDays.get(phase)! / baseRate;
    if (lift >= PATTERN_MIN_LIFT && hit.cycles.size * 2 >= usable.length) {
      patterns.push({ symptom, phase, cyclesWith: hit.cycles.size, cyclesTotal: usable.length, lift });
    }
  }
  return patterns.sort((a, b) => b.cyclesWith / b.cyclesTotal - a.cyclesWith / a.cyclesTotal || b.lift - a.lift);
}

/** Patterns whose phase occurs within the next `horizon` days, for "could appear soon" hints. */
export function upcomingSymptoms(
  patterns: readonly SymptomPattern[],
  prediction: Prediction,
  today: ISODate,
  horizon = 3,
): SymptomPattern[] {
  const length = diffDays(prediction.nextPeriod.mostLikely, prediction.cycleStart);
  const ov = prediction.ovulation ? diffDays(prediction.ovulation.mostLikely, prediction.cycleStart) : length - 12;
  const periodLength = 5;
  const phases = new Set<Phase>();
  for (let d = 1; d <= horizon; d++) {
    const offset = diffDays(addDays(today, d), prediction.cycleStart);
    phases.add(offset >= length ? 'menstruation' : phaseOf(offset, length, periodLength, ov));
  }
  return patterns.filter((p) => phases.has(p.phase));
}
