import { describe, expect, it } from 'vitest';
import { addDays } from '../../engine/dates.ts';
import { mergeLogs, periodLogs } from '../../engine/fixtures.ts';
import type { DayLog } from '../../engine/types.ts';
import { insightsModel } from './insightsModel.ts';

describe('insightsModel', () => {
  it('summarises cycles and marks excluded ones', () => {
    const { logs, current } = periodLogs('2026-01-05', [28, 29, 60, 27, 28]);
    const m = insightsModel(logs, { mode: 'track' }, addDays(current, 10));
    expect(m.stats).toMatchObject({ n: 4, minLength: 27, maxLength: 29, regularity: 'regular' });
    expect(m.cycleBars.map((b) => [b.value, !!b.muted])).toEqual([[28, false], [29, false], [60, true], [27, false], [28, false]]);
    expect(m.cycleBars[2]!.description).toMatch(/60 Tage \(nicht mitgezählt\)/);
    expect(m.periodBars).toHaveLength(6);
    expect(m.rows[0]).toMatchObject({ start: current, period: 5 });
    expect(m.rows[0]!.cycle).toBeUndefined();
  });

  it('phrases symptom patterns as sentences', () => {
    const lengths = [28, 28, 28, 28, 28];
    const { logs, current } = periodLogs('2025-01-01', lengths);
    const starts = [0, 28, 56, 84, 112].map((o) => addDays('2025-01-01', o));
    const sym: DayLog[] = starts.slice(0, 4).flatMap((s) => [
      { date: addDays(s, 26), symptoms: ['headache'] },
      { date: addDays(s, 27), symptoms: ['headache'] },
    ]);
    const m = insightsModel(mergeLogs(logs, sym), { mode: 'track' }, addDays(current, 3));
    expect(m.patterns[0]).toBe('In 4 von 5 Zyklen hattest du in den drei Tagen vor der Periode Kopfschmerzen.');
  });
});
