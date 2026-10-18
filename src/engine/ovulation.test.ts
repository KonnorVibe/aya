import { describe, expect, it } from 'vitest';
import { deriveCycles } from './cycles.ts';
import { bbtLogs, mergeLogs, periodLogs } from './fixtures.ts';
import { confirmOvulation, detectBbtShift, detectLhOvulation } from './ovulation.ts';

describe('BBT 3-over-6', () => {
  it('detects a clear rise', () => {
    const shift = detectBbtShift(bbtLogs('2026-03-01', 25, 15));
    expect(shift).toMatchObject({ ovulationDate: '2026-03-15', firstHighDate: '2026-03-16' });
    expect(shift!.coverline).toBeCloseTo(36.44, 2);
  });

  it('skips disturbed readings', () => {
    const logs = bbtLogs('2026-03-01', 25, 15);
    // A three-day fever spike looks like a premature rise; marked as disturbed it must be ignored.
    for (const i of [8, 9, 10]) logs[i]!.bbt = { value: 37.3, disturbed: true, reason: 'Fieber' };
    expect(detectBbtShift(logs)?.ovulationDate).toBe('2026-03-15');
    for (const i of [8, 9, 10]) delete logs[i]!.bbt!.disturbed;
    expect(detectBbtShift(logs)?.ovulationDate).toBe('2026-03-08');
  });

  it('finds nothing in an anovulatory cycle', () => {
    expect(detectBbtShift(bbtLogs('2026-03-01', 30, null))).toBeNull();
  });

  it('requires the third high reading to be ≥ 0.2 °C above the coverline', () => {
    expect(detectBbtShift(bbtLogs('2026-03-01', 25, 15, 36.4, 36.55))).toBeNull();
  });
});

describe('LH', () => {
  it('puts ovulation on the day after the first positive test', () => {
    const logs = [
      { date: '2026-03-12', lhTest: 'negative' as const },
      { date: '2026-03-14', lhTest: 'positive' as const },
      { date: '2026-03-15', lhTest: 'peak' as const },
    ];
    expect(detectLhOvulation(logs)).toBe('2026-03-15');
    expect(confirmOvulation(logs)).toEqual({ date: '2026-03-15', source: 'lh' });
  });

  it('lets BBT win when both exist', () => {
    const logs = mergeLogs(bbtLogs('2026-03-01', 25, 15), [{ date: '2026-03-13', lhTest: 'positive' }]);
    expect(confirmOvulation(logs)).toMatchObject({ date: '2026-03-15', source: 'bbt+lh' });
  });
});

describe('luteal length of completed cycles', () => {
  it('is next start minus ovulation', () => {
    const { logs } = periodLogs('2026-03-01', [28]);
    const cycles = deriveCycles(mergeLogs(logs, bbtLogs('2026-03-01', 28, 15)));
    expect(cycles[0]).toMatchObject({ ovulationDate: '2026-03-15', ovulationSource: 'bbt', lutealLength: 14 });
  });

  it('is skipped under hormonal contraception', () => {
    const { logs } = periodLogs('2026-03-01', [28]);
    const cycles = deriveCycles(mergeLogs(logs, bbtLogs('2026-03-01', 28, 15)), { mode: 'hormonal_contraception' });
    expect(cycles[0]!.ovulationDate).toBeUndefined();
  });
});
