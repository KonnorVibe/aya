import { describe, expect, it } from 'vitest';
import { predict } from '../../engine/prediction.ts';
import { addDays } from '../../engine/dates.ts';
import type { DayLog } from '../../engine/types.ts';
import { de } from '../../i18n/de.ts';
import { phaseQuote, quotePhase } from './phaseQuote.ts';

// Three regular 28-day cycles, the last one starting on 2026-09-01.
const starts = ['2026-07-07', '2026-08-04', '2026-09-01'];
const logs: DayLog[] = starts.flatMap((s) => [0, 1, 2, 3, 4].map((i) => ({ date: addDays(s, i), flow: 'medium' as const })));
const at = (today: string, mode: 'track' | 'hormonal_contraception' = 'track') =>
  quotePhase(predict({ logs, settings: { mode }, today })!, today, mode);

describe('quotePhase', () => {
  it('follows the cycle', () => {
    expect(at('2026-09-02')).toBe('menstruation');
    expect(at('2026-09-08')).toBe('follicular');
    expect(at('2026-09-17')).toBe('ovulation');
    expect(at('2026-09-23')).toBe('luteal');
    expect(at('2026-09-28')).toBe('premenstrual');
  });

  it('has no cycle phases under hormonal contraception, apart from the bleed', () => {
    expect(at('2026-09-02', 'hormonal_contraception')).toBe('menstruation');
    expect(at('2026-09-14', 'hormonal_contraception')).toBe('hormonal');
  });
});

describe('phaseQuote', () => {
  it('keeps one line per day and picks it from the phase', () => {
    const p = predict({ logs, settings: { mode: 'track' }, today: '2026-09-23' })!;
    const a = phaseQuote(p, '2026-09-23', 'track');
    expect(phaseQuote(p, '2026-09-23', 'track')).toEqual(a);
    expect(de.quotes.luteal as readonly string[]).toContain(a.text);
  });
});
