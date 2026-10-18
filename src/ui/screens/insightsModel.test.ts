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

describe('insights: temperature and accuracy', () => {
  it('shows the running cycle temperature with coverline and ovulation day', async () => {
    const { bbtLogs, mergeLogs, periodLogs } = await import('../../engine/fixtures.ts');
    const { addDays } = await import('../../engine/dates.ts');
    const { logs, current } = periodLogs('2026-01-05', [28, 28, 28, 28]);
    const withBbt = mergeLogs(logs, bbtLogs(current, 20, 15));
    const disturbed = withBbt.map((l) => (l.date === addDays(current, 4) ? { ...l, bbt: { value: 37.2, disturbed: true } } : l));
    const m = insightsModel(disturbed, { mode: 'track' }, addDays(current, 19));
    expect(m.temperature.points).toHaveLength(20);
    expect(m.temperature.points.filter((p) => p.disturbed)).toHaveLength(1);
    expect(m.temperature.ovulationDay).toBe(15);
    expect(m.temperature.coverline).toBeGreaterThan(36.3);
    expect(m.accuracy?.n).toBe(2); // 4 completed cycles, backtest from the 3rd on
    expect(m.accuracy?.mae).toBeLessThan(1); // early estimates lean towards the 29-day prior
  });

  it('ignores temperature under hormonal contraception and has no accuracy with few cycles', async () => {
    const { bbtLogs, mergeLogs, periodLogs } = await import('../../engine/fixtures.ts');
    const { addDays } = await import('../../engine/dates.ts');
    const { logs, current } = periodLogs('2026-01-05', [28]);
    const m = insightsModel(mergeLogs(logs, bbtLogs(current, 20, 15)), { mode: 'hormonal_contraception' }, addDays(current, 19));
    expect(m.temperature.ovulationDay).toBeUndefined();
    expect(m.accuracy).toBeNull();
  });
});
