import { describe, expect, it } from 'vitest';
import { addDays } from '../../engine/dates.ts';
import { predict } from '../../engine/prediction.ts';
import type { DayLog, Mode } from '../../engine/types.ts';
import { confidencePercent } from '../components/ConfidenceDonut.tsx';
import { focusModel } from './focusModel.ts';

const starts = ['2026-06-09', '2026-07-07', '2026-08-04', '2026-09-01'];
const logs: DayLog[] = starts.flatMap((s) => [0, 1, 2, 3, 4].map((i) => ({ date: addDays(s, i), flow: 'medium' as const, ...(i === 4 ? { periodEnd: true } : {}) })));
const at = (today: string, mode: Mode) => focusModel(predict({ logs, settings: { mode }, today })!, logs, { mode }, today);

describe('focusModel', () => {
  it('puts the next period first when tracking', () => {
    const f = at('2026-09-10', 'track');
    expect(f.kind).toBe('next');
    expect(f.title).toBe('Nächste Periode');
    expect(f.headline).toMatch(/^in \d+ Tagen · /);
    expect(f.rows[0]).toBe('Dauer meist 5 Tage');
    expect(f.rows[1]).toBe('Dein letzter Zyklus: 28 Tage');
  });

  it('reminds to get ready in the last days', () => {
    expect(at('2026-09-27', 'track').rows.at(-1)).toMatch(/Binden, Tampons/);
  });

  it('puts the fertile window first when trying to conceive, and the test after it', () => {
    const before = at('2026-09-06', 'conceive');
    expect(before.kind).toBe('fertile');
    expect(before.title).toBe('Fruchtbares Fenster');
    expect(before.rows.some((r) => r.startsWith('LH-Tests ab'))).toBe(true);
    const after = at('2026-09-24', 'conceive');
    expect(after.title).toBe('Nach dem fruchtbaren Fenster');
    expect(after.rows[0]).toMatch(/Schwangerschaftstest ist ab/);
  });

  it('shows the next bleed and no fertile window under hormonal contraception', () => {
    const f = at('2026-09-14', 'hormonal_contraception');
    expect(f.kind).toBe('bleed');
    expect(f.title).toBe('Nächste Blutung');
    expect(f.rows.join(' ')).not.toMatch(/fruchtbar|Eisprung/i);
  });
});

describe('confidencePercent', () => {
  it('counts complete cycles out of six', () => {
    expect(confidencePercent({ usedCycles: 0 })).toBe(0);
    expect(confidencePercent({ usedCycles: 3 })).toBe(50);
    expect(confidencePercent({ usedCycles: 12 })).toBe(100);
  });
});
