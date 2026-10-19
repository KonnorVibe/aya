import { describe, expect, it } from 'vitest';
import type { DayLog } from '../../engine/types.ts';
import { draftChanges, draftFrom, draftLogs, draftWarnings, runs, tapDay } from './periodDraft.ts';

const logs: DayLog[] = [
  { date: '2026-09-01', flow: 'medium' },
  { date: '2026-09-02', flow: 'heavy', symptoms: ['cramps'] },
  { date: '2026-09-10', mood: ['calm'] },
];

describe('period draft', () => {
  it('fills the days between two taps', () => {
    let d = draftFrom(logs);
    d = tapDay(d, '2026-09-29');
    expect(d.anchor).toBe('2026-09-29');
    d = tapDay(d, '2026-10-03');
    expect(d.anchor).toBeNull();
    expect(draftChanges(logs, d).added).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('also fills backwards and removes a marked day with one tap', () => {
    let d = tapDay(tapDay(draftFrom(logs), '2026-10-03'), '2026-10-01');
    expect(runs(d.days)).toEqual([['2026-09-01', '2026-09-02'], ['2026-10-01', '2026-10-03']]);
    d = tapDay(d, '2026-09-02');
    expect(draftChanges(logs, d).removed).toEqual(['2026-09-02']);
  });

  it('extends an existing period when the range ends on a marked day', () => {
    const d = tapDay(tapDay(draftFrom(logs), '2026-09-04'), '2026-09-02');
    expect(runs(d.days)).toEqual([['2026-09-01', '2026-09-04']]);
  });

  it('shows the draft without losing other entries', () => {
    const d = tapDay(tapDay(draftFrom(logs), '2026-09-02'), '2026-09-10');
    const shown = draftLogs(logs, d);
    expect(shown.find((l) => l.date === '2026-09-02')).toEqual({ date: '2026-09-02', symptoms: ['cramps'] });
    expect(shown.find((l) => l.date === '2026-09-10')).toEqual({ date: '2026-09-10', mood: ['calm'], flow: 'medium' });
  });

  it('warns about long periods, close starts and single days', () => {
    let d = tapDay(tapDay(draftFrom(logs), '2026-09-12'), '2026-09-24');
    expect(draftWarnings(d, draftChanges(logs, d))).toEqual([
      { kind: 'close', first: '2026-09-01', second: '2026-09-12', days: 11 },
      { kind: 'long', start: '2026-09-12', end: '2026-09-24', days: 13 },
    ]);
    d = tapDay(draftFrom(logs), '2026-10-20');
    expect(draftWarnings(d, draftChanges(logs, d))).toEqual([{ kind: 'single', date: '2026-10-20' }]);
  });

  it('has nothing to say about an ordinary period', () => {
    const d = tapDay(tapDay(draftFrom(logs), '2026-09-29'), '2026-10-03');
    expect(draftWarnings(d, draftChanges(logs, d))).toEqual([]);
  });
});
