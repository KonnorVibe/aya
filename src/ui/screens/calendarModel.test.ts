import { describe, expect, it } from 'vitest';
import { addDays } from '../../engine/dates.ts';
import { periodLogs } from '../../engine/fixtures.ts';
import { predict } from '../../engine/prediction.ts';
import { calendarMonth, expectedPeriodLength, fromMonthIndex, monthIndex, predictedPeriodDays } from './calendarModel.ts';

describe('calendarMonth', () => {
  it('starts weeks on Monday and covers the month', () => {
    // 1 Oct 2026 is a Thursday.
    const weeks = calendarMonth(2026, 10, [], null, new Set(), '2026-10-16');
    expect(weeks[0]![0]!.date).toBe('2026-09-28');
    expect(weeks[0]![3]).toMatchObject({ date: '2026-10-01', inMonth: true });
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31);
    expect(weeks.flat().find((d) => d.isToday)?.date).toBe('2026-10-16');
  });

  it('handles February in a leap year', () => {
    const days = calendarMonth(2028, 2, [], null, new Set(), '2028-02-01').flat().filter((d) => d.inMonth);
    expect(days.at(-1)!.date).toBe('2028-02-29');
  });

  it('marks logged, predicted and fertile days', () => {
    const { logs, current } = periodLogs('2026-06-01', [28, 28, 28, 28]);
    const today = addDays(current, 6);
    const p = predict({ logs, settings: { mode: 'track' }, today })!;
    const predicted = predictedPeriodDays(p, expectedPeriodLength(logs, {}), today);
    const month = Number(current.slice(5, 7));
    const all = [...calendarMonth(2026, month, logs, p, predicted, today), ...calendarMonth(2026, month + 1, logs, p, predicted, today)].flat();
    const byDate = new Map(all.map((d) => [d.date, d]));
    expect(byDate.get(current)!.period).toBe('logged');
    expect(byDate.get(p.nextPeriod.mostLikely)!.period).toBe('predicted');
    expect(byDate.get(p.ovulation!.mostLikely)).toMatchObject({ ovulation: true, fertility: 'peak' });
    expect(expectedPeriodLength(logs, {})).toBe(5);
  });

  it('flags other entries', () => {
    const days = calendarMonth(2026, 10, [{ date: '2026-10-05', mood: ['calm'] }, { date: '2026-10-06', flow: 'light' }], null, new Set(), '2026-10-16').flat();
    expect(days.find((d) => d.date === '2026-10-05')!.hasEntry).toBe(true);
    expect(days.find((d) => d.date === '2026-10-06')!.hasEntry).toBe(false);
  });
});

describe('month index', () => {
  it('round-trips across year ends', () => {
    expect(fromMonthIndex(monthIndex('2026-12-05') + 1)).toEqual({ year: 2027, month: 1 });
  });
});
