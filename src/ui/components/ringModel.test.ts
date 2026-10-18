import { describe, expect, it } from 'vitest';
import { addDays } from '../../engine/dates.ts';
import { periodLogs } from '../../engine/fixtures.ts';
import { predict } from '../../engine/prediction.ts';
import { ringModel } from './ringModel.ts';

describe('ringModel', () => {
  const { logs, current } = periodLogs('2026-01-05', Array(6).fill(28));
  const today = addDays(current, 2);
  const p = predict({ logs, settings: { mode: 'track' }, today })!;
  const m = ringModel(p, logs, today);

  it('has one dot per expected cycle day and marks today', () => {
    expect(m.length).toBe(28);
    expect(m.days.filter((d) => d.isToday).map((d) => d.offset)).toEqual([2]);
  });

  it('sizes period dots by flow and marks forecast days', () => {
    expect(m.days[0]).toMatchObject({ kind: 'period', magnitude: 4, predicted: false });
    expect(m.days[1]!.magnitude).toBe(3);
    expect(m.days[3]!.predicted).toBe(true);
    expect(m.days.find((d) => d.kind === 'ovulation')!.offset).toBe(16);
    expect(m.days[27]!.kind).toBe('luteal');
  });

  it('has no fertility phases under hormonal contraception', () => {
    const h = predict({ logs, settings: { mode: 'hormonal_contraception' }, today })!;
    expect(new Set(ringModel(h, logs, today).days.map((d) => d.kind))).toEqual(new Set(['period', 'neutral']));
  });
});
