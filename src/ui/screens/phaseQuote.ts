import { diffDays, type ISODate } from '../../engine/dates.ts';
import type { Prediction } from '../../engine/prediction.ts';
import type { Mode } from '../../engine/types.ts';
import { de } from '../../i18n/de.ts';

export type QuotePhase = keyof typeof de.quotes;

const OVULATION_DAYS = 2;

/**
 * Which phase the line on Today speaks to: the period, the three days before the next one, the days
 * around the likeliest ovulation, after it, and the days in between. Under
 * hormonal contraception there is no cycle phase to speak of, so only the bleed is singled out.
 */
export function quotePhase(p: Prediction, today: ISODate, mode: Mode): QuotePhase {
  if (p.periodDay !== undefined) return 'menstruation';
  if (mode === 'hormonal_contraception') return 'hormonal';
  if (p.lateByDays !== undefined) return 'late';
  const untilNext = diffDays(p.nextPeriod.mostLikely, today);
  if (untilNext <= 3) return 'premenstrual';
  // The fertile window is wide while data is thin, so "around ovulation" means the likeliest day ± 2.
  const ov = p.ovulation?.mostLikely;
  if (!ov) return 'follicular';
  const fromOv = diffDays(today, ov);
  if (Math.abs(fromOv) <= OVULATION_DAYS) return 'ovulation';
  return fromOv > 0 ? 'luteal' : 'follicular';
}

/** One line per day: stable while the day lasts, a different one tomorrow. */
export function phaseQuote(p: Prediction, today: ISODate, mode: Mode): { phase: QuotePhase; text: string } {
  const phase = quotePhase(p, today, mode);
  const lines = de.quotes[phase];
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  return { phase, text: lines[day % lines.length]! };
}
