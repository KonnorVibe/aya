import { describe, expect, it } from 'vitest';
import { deriveCycles, derivePeriods, openPeriod } from './cycles.ts';
import { periodLogs } from './fixtures.ts';
import type { DayLog } from './types.ts';

describe('derivePeriods', () => {
  it('ignores spotting-only phases and merges short gaps', () => {
    const logs: DayLog[] = [
      { date: '2026-01-01', flow: 'spotting' },
      { date: '2026-01-02', flow: 'medium' },
      { date: '2026-01-03', flow: 'light' },
      { date: '2026-01-06', flow: 'light' }, // 2 bleed-free days → same period
      { date: '2026-01-15', flow: 'spotting' },
      { date: '2026-01-29', flow: 'heavy' },
    ];
    expect(derivePeriods(logs)).toEqual([
      { start: '2026-01-02', end: '2026-01-06', length: 5 },
      { start: '2026-01-29', end: '2026-01-29', length: 1 },
    ]);
  });

  it('splits phases with 3 or more bleed-free days', () => {
    const logs: DayLog[] = [
      { date: '2026-01-01', flow: 'medium' },
      { date: '2026-01-05', flow: 'medium' },
    ];
    expect(derivePeriods(logs)).toHaveLength(2);
  });
});

describe('deriveCycles', () => {
  it('derives lengths and keeps the ongoing cycle open', () => {
    const { logs } = periodLogs('2026-01-01', [28, 28]);
    const cycles = deriveCycles(logs);
    expect(cycles.map((c) => c.length)).toEqual([28, 28, undefined]);
    expect(cycles[0]).toMatchObject({ endDate: '2026-01-28', periodLength: 5 });
  });

  it('flags a forgotten period (60-day cycle) and honours the user override', () => {
    const { logs } = periodLogs('2025-01-01', [28, 29, 28, 27, 28, 60, 28, 29]);
    const flagged = deriveCycles(logs).find((c) => c.length === 60)!;
    expect(flagged.excluded?.reason).toBe('possible_missed_log');

    const included = deriveCycles(logs, { overrides: { include: new Set([flagged.startDate]) } });
    expect(included.find((c) => c.length === 60)!.excluded).toBeUndefined();
  });

  it('marks implausible lengths as outliers and positive tests as pregnancy', () => {
    const { logs } = periodLogs('2025-01-01', [28, 10, 28, 120, 28]);
    logs.push({ date: '2025-01-10', pregnancyTest: 'positive' });
    const reasons = deriveCycles(logs).map((c) => c.excluded?.reason);
    expect(reasons).toEqual(['pregnancy', 'outlier', undefined, 'outlier', undefined, undefined]);
  });

  it('can be excluded by the user', () => {
    const { logs } = periodLogs('2025-01-01', [28, 28]);
    const cycles = deriveCycles(logs, { overrides: { exclude: new Set(['2025-01-01']) } });
    expect(cycles[0]!.excluded?.reason).toBe('user');
  });
});

describe('openPeriod', () => {
  const start: DayLog[] = [{ date: '2026-10-10', flow: 'heavy' }];

  it('keeps a just-started period open for the next days', () => {
    expect(openPeriod(start, '2026-10-10')).toEqual({ start: '2026-10-10', day: 1 });
    expect(openPeriod(start, '2026-10-12')).toEqual({ start: '2026-10-10', day: 3 });
    expect(openPeriod(start, '2026-10-13')).toBeNull();
  });

  it('follows ongoing bleeding and closes on the end mark', () => {
    const logs: DayLog[] = [...start, { date: '2026-10-13', flow: 'light' }];
    expect(openPeriod(logs, '2026-10-15')?.day).toBe(6);
    const ended: DayLog[] = [...start, { date: '2026-10-11', flow: 'medium', periodEnd: true }];
    expect(openPeriod(ended, '2026-10-11')?.day).toBe(2);
    expect(openPeriod(ended, '2026-10-12')).toBeNull();
  });

  it('never runs longer than 10 days', () => {
    const logs: DayLog[] = Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(10 + i).padStart(2, '0')}`, flow: 'light' as const }));
    expect(openPeriod(logs, '2026-10-19')?.day).toBe(10);
    expect(openPeriod(logs, '2026-10-20')).toBeNull();
  });
});
