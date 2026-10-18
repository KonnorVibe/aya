import { describe, expect, it } from 'vitest';
import { hasAdvanced, parseMedication, parseTemperature } from './AdvancedLog.tsx';

describe('advanced log parsing', () => {
  it('reads German and English decimals and rejects implausible values', () => {
    expect(parseTemperature('36,55')).toBe(36.55);
    expect(parseTemperature(' 36.5 ')).toBe(36.5);
    expect(parseTemperature('36,555')).toBe(36.56);
    expect(parseTemperature('')).toBeUndefined();
    expect(parseTemperature('3655')).toBe('invalid');
    expect(parseTemperature('abc')).toBe('invalid');
  });

  it('splits medication on commas, semicolons and lines', () => {
    expect(parseMedication('Ibuprofen, Eisen;Magnesium\n')).toEqual(['Ibuprofen', 'Eisen', 'Magnesium']);
    expect(parseMedication(' , ')).toBeUndefined();
  });

  it('knows when a day holds advanced data', () => {
    expect(hasAdvanced({ date: '2026-01-01', flow: 'light' })).toBe(false);
    expect(hasAdvanced({ date: '2026-01-01', lhTest: 'positive' })).toBe(true);
    expect(hasAdvanced({ date: '2026-01-01', medication: [] })).toBe(false);
  });
});
