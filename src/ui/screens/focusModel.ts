import { validCycles, deriveCycles } from '../../engine/cycles.ts';
import { addDays, diffDays, type ISODate } from '../../engine/dates.ts';
import type { Prediction } from '../../engine/prediction.ts';
import { overridesFrom, type DayLog, type Settings } from '../../engine/types.ts';
import { de, formatDayMonth, formatRange } from '../../i18n/de.ts';
import { expectedPeriodLength } from './calendarModel.ts';

export interface Focus {
  kind: 'next' | 'fertile' | 'bleed';
  title: string;
  /** The one line that matters most, e.g. "in 12 Tagen · 15.–19. Nov." */
  headline: string;
  rows: string[];
}

const f = de.focus;
const inDays = (n: number) => (n <= 0 ? f.today : n === 1 ? f.tomorrow : f.inDays(n));

/** A test is meaningful about two weeks after ovulation, i.e. around the expected period. */
const TEST_AFTER_OVULATION = 14;

/**
 * The Today card for what the mode is about: Zyklus verfolgen puts the next period first,
 * Kinderwunsch the fertile window, hormonal contraception the next bleed. Under hormonal
 * contraception there is usually no ovulation, so no fertile window is shown there.
 */
export function focusModel(
  p: Prediction,
  logs: readonly DayLog[],
  settings: Pick<Settings, 'mode' | 'defaultPeriodLength' | 'includedCycles' | 'excludedCycles'>,
  today: ISODate,
): Focus {
  const next = p.nextPeriod;
  const untilNext = diffDays(next.mostLikely, today);
  const range = formatRange(next.earliest, next.latest);

  if (settings.mode === 'conceive' && p.fertileWindow && p.ovulation) {
    const w = p.fertileWindow;
    const ov = p.ovulation.mostLikely;
    const rows: string[] = [];
    if (today <= w.end) {
      rows.push(f.peak(formatRange(w.peakStart, w.peakEnd)));
      rows.push(p.ovulation.confirmed ? f.ovulationConfirmed(formatDayMonth(ov)) : f.ovulation(formatDayMonth(ov)));
      rows.push(today < w.start ? f.lhFrom(formatDayMonth(addDays(w.start, -1))) : f.timing);
      const headline = today < w.start ? `${inDays(diffDays(w.start, today))} · ${formatRange(w.start, w.end)}` : f.now(formatDayMonth(w.end));
      return { kind: 'fertile', title: f.fertileTitle, headline, rows };
    }
    // The window is over: what comes next is the test, then the next window.
    rows.push(f.testFrom(formatDayMonth(addDays(ov, TEST_AFTER_OVULATION))));
    rows.push(f.nextPeriod(range));
    return { kind: 'fertile', title: f.afterTitle, headline: f.waiting, rows };
  }

  const hormonal = settings.mode === 'hormonal_contraception';
  const headline = `${inDays(untilNext)} · ${range}`;
  if (hormonal) {
    return { kind: 'bleed', title: f.bleedTitle, headline, rows: [...f.hormonalRows] };
  }

  const cycles = validCycles(deriveCycles(logs.filter((l) => l.date <= today), { mode: settings.mode, overrides: overridesFrom(settings) }));
  const last = cycles.at(-1);
  const rows = [f.duration(expectedPeriodLength(logs, settings))];
  if (last?.length) rows.push(f.lastCycle(last.length));
  rows.push(untilNext <= 3 ? f.prepare : f.spread(range));
  return { kind: 'next', title: f.nextTitle, headline, rows };
}
