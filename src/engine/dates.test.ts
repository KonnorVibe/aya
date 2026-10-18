import { describe, expect, it } from 'vitest';
import { addDays, diffDays, eachDay, isISODate, todayLocal } from './dates.ts';

describe('dates', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(diffDays('2027-01-02', '2026-12-30')).toBe(3);
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(diffDays('2028-03-01', '2028-02-01')).toBe(29);
    expect(isISODate('2027-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
  });

  it('is unaffected by DST changes (EU: 29 Mar and 25 Oct 2026)', () => {
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2);
    expect(diffDays('2026-10-26', '2026-10-24')).toBe(2);
    expect(eachDay('2026-03-28', '2026-03-30')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
    expect(addDays('2026-10-24', 28)).toBe('2026-11-21');
  });

  it('uses the local calendar day for today', () => {
    expect(todayLocal(new Date(2026, 9, 25, 23, 30))).toBe('2026-10-25');
  });

  it('rejects malformed dates', () => {
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('26-01-01')).toBe(false);
    expect(() => addDays('nope', 1)).toThrow(RangeError);
  });
});
