import { describe, expect, it } from 'vitest';
import { addDays } from '../engine/dates.ts';
import { predict } from '../engine/prediction.ts';
import type { DayLog, Mode } from '../engine/types.ts';
import { statement } from './de.ts';

const starts = ['2026-07-07', '2026-08-04', '2026-09-01'];
const logs: DayLog[] = starts.flatMap((s) => [0, 1, 2, 3, 4].map((i) => ({ date: addDays(s, i), flow: 'medium' as const })));
const say = (today: string, mode: Mode) => statement(predict({ logs, settings: { mode }, today })!, today, mode);

describe('statement by mode', () => {
  it('speaks of the period when tracking', () => {
    expect(say('2026-09-02', 'track')).toBe('Tag 2 deiner Periode');
    expect(say('2026-09-08', 'track')).toMatch(/^Periode in \d+ Tagen$/);
  });

  it('leads with the fertile days when trying to conceive', () => {
    for (const d of ['2026-09-10', '2026-09-14', '2026-09-17']) {
      expect(say(d, 'conceive')).toMatch(/^(Fruchtbare Tage|Hohe Fruchtbarkeit|Eisprung voraussichtlich heute)/);
    }
    expect(say('2026-09-02', 'conceive')).toBe('Tag 2 deiner Periode');
  });

  it('says Blutung under hormonal contraception and never mentions fertility', () => {
    expect(say('2026-09-02', 'hormonal_contraception')).toBe('Tag 2 deiner Blutung');
    for (const d of ['2026-09-10', '2026-09-16', '2026-09-20']) {
      expect(say(d, 'hormonal_contraception')).toMatch(/^Blutung (in \d+ Tagen|morgen)$/);
    }
  });
});
