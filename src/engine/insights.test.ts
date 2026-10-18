import { describe, expect, it } from 'vitest';
import { deriveCycles } from './cycles.ts';
import { addDays } from './dates.ts';
import { mergeLogs, periodLogs } from './fixtures.ts';
import { cycleStats, healthNotices, phaseOf, symptomPatterns, upcomingSymptoms } from './insights.ts';
import { predict } from './prediction.ts';
import type { DayLog } from './types.ts';

describe('cycleStats', () => {
  it('summarises valid cycles and FIGO regularity', () => {
    const cycles = deriveCycles(periodLogs('2025-01-01', [27, 28, 30, 29]).logs);
    expect(cycleStats(cycles)).toMatchObject({ n: 4, medianLength: 28.5, minLength: 27, maxLength: 30, variation: 3, medianPeriodLength: 5, regularity: 'regular' });
    expect(cycleStats(deriveCycles(periodLogs('2025-01-01', [24, 36, 28]).logs), 30).regularity).toBe('irregular');
    expect(cycleStats([]).regularity).toBe('unknown');
  });
});

describe('healthNotices', () => {
  it('flags long cycles and long periods', () => {
    const { logs, current } = periodLogs('2024-01-01', [42, 41, 43], 10);
    expect(healthNotices(deriveCycles(logs), logs, addDays(current, 12))).toEqual(['long_cycles', 'long_periods']);
  });

  it('flags short cycles and high variability', () => {
    const short = periodLogs('2024-01-01', [21, 22, 21]);
    expect(healthNotices(deriveCycles(short.logs), short.logs, addDays(short.current, 6))).toEqual(['short_cycles']);
    const varied = periodLogs('2024-01-01', [25, 37, 30]);
    expect(healthNotices(deriveCycles(varied.logs), varied.logs, addDays(varied.current, 6))).toEqual(['high_variability']);
  });

  it('flags an absent period unless pregnant', () => {
    const { logs, current } = periodLogs('2024-01-01', [28, 28, 28]);
    const today = addDays(current, 95);
    expect(healthNotices(deriveCycles(logs), logs, today)).toEqual(['absent_period']);
    const pregnant = mergeLogs(logs, [{ date: addDays(current, 35), pregnancyTest: 'positive' }]);
    expect(healthNotices(deriveCycles(pregnant), pregnant, today)).toEqual([]);
  });
});

describe('phaseOf', () => {
  it('assigns phases with the documented priority', () => {
    // 28-day cycle, 5-day period, ovulation on offset 15
    expect([0, 4, 5, 9, 10, 16, 17, 24, 25, 27].map((o) => phaseOf(o, 28, 5, 15))).toEqual([
      'menstruation', 'menstruation', 'follicular', 'follicular', 'ovulation', 'ovulation',
      'luteal', 'luteal', 'premenstrual', 'premenstrual',
    ]);
  });
});

describe('symptomPatterns', () => {
  const { logs, current } = periodLogs('2025-01-01', [28, 28, 28, 28, 28]);
  const starts = [0, 28, 56, 84, 112].map((o) => addDays('2025-01-01', o));
  // Headache in the 2 days before the period in 4 of 5 cycles; fatigue spread evenly.
  const symptomLogs: DayLog[] = starts.flatMap((s, i) => [
    ...(i < 4 ? [{ date: addDays(s, 26), symptoms: ['headache' as const] }, { date: addDays(s, 27), symptoms: ['headache' as const] }] : []),
    { date: addDays(s, 3 + i * 5), symptoms: ['fatigue' as const] },
  ]);
  const all = mergeLogs(logs, symptomLogs);
  const cycles = deriveCycles(all);

  it('finds the premenstrual headache pattern and ignores noise', () => {
    const patterns = symptomPatterns(all, cycles);
    expect(patterns[0]).toMatchObject({ symptom: 'headache', phase: 'premenstrual', cyclesWith: 4, cyclesTotal: 5 });
    expect(patterns.some((p) => p.symptom === 'fatigue')).toBe(false);
  });

  it('needs at least 3 cycles', () => {
    const few = deriveCycles(periodLogs('2025-01-01', [28, 28]).logs);
    expect(symptomPatterns(all, few)).toEqual([]);
  });

  it('hints at symptoms expected in the next days', () => {
    const patterns = symptomPatterns(all, cycles);
    const p = predict({ logs: all, settings: { mode: 'track' }, today: addDays(current, 24) })!;
    expect(upcomingSymptoms(patterns, p, addDays(current, 24)).map((x) => x.symptom)).toContain('headache');
    expect(upcomingSymptoms(patterns, p, addDays(current, 8))).toEqual([]);
  });
});
