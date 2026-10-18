import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from './dates.ts';
import { bbtLogs, mergeLogs, periodLogs, rng } from './fixtures.ts';
import { estimateCycleLength, fertilityLevel, predict, upcomingPeriods } from './prediction.ts';
import type { Settings } from './types.ts';

const track: Pick<Settings, 'mode'> = { mode: 'track' };
const span = (r: { earliest: string; latest: string }) => diffDays(r.latest, r.earliest);

describe('regular 28-day cycles', () => {
  const { logs, current } = periodLogs('2026-01-05', Array(6).fill(28));
  const p = predict({ logs, settings: track, today: addDays(current, 3) })!;

  it('predicts day 28 with a tight range and high confidence', () => {
    expect(p.nextPeriod.mostLikely).toBe(addDays(current, 28));
    expect(span(p.nextPeriod)).toBeLessThanOrEqual(4);
    expect(p.confidence).toBe('high');
    expect(p.cycleDay).toBe(4);
    expect(p.periodDay).toBe(4);
    expect(p.basis).toBe('history');
  });

  it('places ovulation via the luteal phase, not on day 14', () => {
    expect(p.ovulation!.mostLikely).toBe(addDays(current, 28 - 12));
    expect(p.ovulation!.confirmed).toBe(false);
    const w = p.fertileWindow!;
    expect(w.start <= w.peakStart && w.peakStart <= w.peakEnd && w.peakEnd <= w.end).toBe(true);
    expect(diffDays(w.peakEnd, w.peakStart)).toBe(2);
    expect(fertilityLevel(p.ovulation!.mostLikely, p)).toBe('peak');
    expect(fertilityLevel(w.start, p)).toBe('high');
    expect(fertilityLevel(current, p)).toBe('none');
  });

  it('lists future periods with growing uncertainty', () => {
    const next = upcomingPeriods(p, 3);
    expect(next.map((r) => r.mostLikely)).toEqual([28, 56, 84].map((d) => addDays(current, d)));
    expect(span(next[2]!)).toBeGreaterThan(span(next[0]!));
  });
});

describe('regular 32-day cycles', () => {
  it('learns the personal length instead of the population prior', () => {
    const { logs, current } = periodLogs('2025-06-01', Array(8).fill(32));
    const p = predict({ logs, settings: track, today: addDays(current, 1) })!;
    expect(p.nextPeriod.mostLikely).toBe(addDays(current, 32));
    expect(p.confidence).toBe('high');
  });
});

describe('irregular cycles (24–38 days, seeded)', () => {
  it('widens the range and flags irregularity', () => {
    const rand = rng(42);
    const lengths = Array.from({ length: 10 }, () => 24 + Math.floor(rand() * 15));
    const { logs, current } = periodLogs('2025-01-01', lengths);
    const p = predict({ logs, settings: track, today: addDays(current, 1) })!;
    expect(p.irregular).toBe(true);
    expect(p.confidence).toBe('medium');
    expect(span(p.nextPeriod)).toBeGreaterThan(6);
  });
});

describe('forgotten period', () => {
  it('excludes a 60-day cycle from the estimate', () => {
    const { logs, current } = periodLogs('2025-01-01', [28, 28, 28, 28, 28, 60, 28, 28, 28]);
    const p = predict({ logs, settings: track, today: addDays(current, 1) })!;
    expect(p.usedCycles).toBe(8);
    expect(p.nextPeriod.mostLikely).toBe(addDays(current, 28));
  });
});

describe('cold start', () => {
  it('returns null without any period', () => {
    expect(predict({ logs: [{ date: '2026-01-01', mood: ['calm'] }], settings: track, today: '2026-01-02' })).toBeNull();
  });

  it('uses 29 days or the onboarding value with 0 cycles', () => {
    const { logs, current } = periodLogs('2026-02-01', []);
    const p = predict({ logs, settings: track, today: current })!;
    expect(p.nextPeriod.mostLikely).toBe(addDays(current, 29));
    expect(p.confidence).toBe('low');
    const own = predict({ logs, settings: { ...track, defaultCycleLength: 33 }, today: current })!;
    expect(own.nextPeriod.mostLikely).toBe(addDays(current, 33));
  });

  it('shrinks 1 and 2 cycles towards the prior', () => {
    const one = periodLogs('2026-01-01', [35]);
    const p1 = predict({ logs: one.logs, settings: track, today: one.current })!;
    // (1·35 + 2.5·29) / 3.5 = 30.7
    expect(p1.nextPeriod.mostLikely).toBe(addDays(one.current, 31));
    expect(p1.confidence).toBe('low');

    const two = periodLogs('2026-01-01', [35, 35]);
    const p2 = predict({ logs: two.logs, settings: track, today: two.current })!;
    // (2·35 + 2·29) / 4 = 32
    expect(p2.nextPeriod.mostLikely).toBe(addDays(two.current, 32));
  });

  it('matches the documented estimate formula', () => {
    expect(estimateCycleLength([]).mean).toBe(29);
    expect(estimateCycleLength([30, 30, 30, 30, 30, 30]).mean).toBe(30);
  });
});

describe('refinement in the current cycle', () => {
  const rand = rng(7);
  const history = Array.from({ length: 6 }, () => 26 + Math.floor(rand() * 9));

  it('narrows the range after a BBT rise', () => {
    const { logs, current } = periodLogs('2025-08-01', history);
    const today = addDays(current, 20);
    const before = predict({ logs, settings: track, today })!;
    const after = predict({ logs: mergeLogs(logs, bbtLogs(current, 21, 15)), settings: track, today })!;
    expect(after.basis).toBe('bbt');
    expect(after.ovulation).toMatchObject({ confirmed: true, mostLikely: addDays(current, 14), source: 'bbt' });
    expect(after.nextPeriod.mostLikely).toBe(addDays(current, 14 + 12));
    expect(span(after.nextPeriod)).toBeLessThan(span(before.nextPeriod));
  });

  it('uses a positive LH test', () => {
    const { logs, current } = periodLogs('2025-08-01', history);
    const withLh = mergeLogs(logs, [{ date: addDays(current, 13), lhTest: 'positive' }]);
    const p = predict({ logs: withLh, settings: track, today: addDays(current, 14) })!;
    expect(p.basis).toBe('lh');
    expect(p.ovulation!.mostLikely).toBe(addDays(current, 14));
    expect(p.nextPeriod.mostLikely).toBe(addDays(current, 26));
  });

  it('uses the personal luteal phase from confirmed past cycles', () => {
    const { logs, current } = periodLogs('2025-08-01', [28, 28, 28, 28]);
    const past = [0, 28, 56, 84].flatMap((o) => bbtLogs(addDays('2025-08-01', o), 28, 18)); // luteal 11
    const all = mergeLogs(logs, past, bbtLogs(current, 21, 18));
    const p = predict({ logs: all, settings: track, today: addDays(current, 20) })!;
    expect(p.nextPeriod.mostLikely).toBe(addDays(current, 17 + 11));
  });
});

describe('special cases', () => {
  const { logs, current } = periodLogs('2026-01-05', Array(6).fill(28));

  it('reports a late period and suggests a test after unprotected sex in the fertile window', () => {
    const p0 = predict({ logs, settings: track, today: addDays(current, 1) })!;
    const sexDay = p0.fertileWindow!.peakStart;
    const late = predict({ logs: mergeLogs(logs, [{ date: sexDay, sex: [{ protected: false }] }]), settings: track, today: addDays(current, 33) })!;
    expect(late.lateByDays).toBe(5);
    expect(late.suggestPregnancyTest).toBe(true);

    const protectedOnly = mergeLogs(logs, [{ date: sexDay, sex: [{ protected: true }] }]);
    expect(predict({ logs: protectedOnly, settings: track, today: addDays(current, 33) })!.suggestPregnancyTest).toBe(false);
  });

  it('is not late within the range', () => {
    expect(predict({ logs, settings: track, today: addDays(current, 28) })!.lateByDays).toBeUndefined();
  });

  it('shows no ovulation or fertile window under hormonal contraception', () => {
    const p = predict({ logs, settings: { mode: 'hormonal_contraception' }, today: addDays(current, 3) })!;
    expect(p.ovulation).toBeUndefined();
    expect(p.fertileWindow).toBeUndefined();
    expect(p.nextPeriod.mostLikely).toBe(addDays(current, 28));
  });

  it('ignores logs after today', () => {
    const future = mergeLogs(logs, [{ date: addDays(current, 10), flow: 'heavy' }]);
    expect(predict({ logs: future, settings: track, today: addDays(current, 3) })!.cycleStart).toBe(current);
  });

  it('predicts across year end and into a leap day', () => {
    const { logs: l, current: c } = periodLogs('2027-11-04', [28, 28, 28]);
    expect(c).toBe('2028-01-27');
    const p = predict({ logs: l, settings: track, today: '2028-02-01' })!;
    expect(p.nextPeriod.mostLikely).toBe('2028-02-24');
    expect(addDays(p.nextPeriod.mostLikely, 5)).toBe('2028-02-29');
  });
});
