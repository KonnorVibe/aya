import { addDays, diffDays, eachDay, maxDate, minDate, type ISODate } from '../../engine/dates.ts';
import type { DayLog } from '../../engine/types.ts';

/**
 * Back-entry of periods in the calendar, before anything is saved. The first tap marks a start,
 * the second an end, and every day in between is filled; a tap on a marked day removes it.
 * "Fertig" then shows what changes and asks again, especially when something looks off.
 */
export interface PeriodDraft {
  days: ReadonlySet<ISODate>;
  /** First tap of a range, waiting for its end. */
  anchor: ISODate | null;
}

const bleeding = (l: DayLog) => !!l.flow && l.flow !== 'spotting';

export function draftFrom(logs: readonly DayLog[]): PeriodDraft {
  return { days: new Set(logs.filter(bleeding).map((l) => l.date)), anchor: null };
}

export function tapDay(draft: PeriodDraft, date: ISODate): PeriodDraft {
  const days = new Set(draft.days);
  // A range in progress always closes, even on a marked day: that extends an existing period.
  if (draft.anchor && draft.anchor !== date) {
    for (const d of eachDay(minDate(draft.anchor, date), maxDate(draft.anchor, date))) days.add(d);
    return { days, anchor: null };
  }
  if (days.has(date)) {
    days.delete(date);
    return { days, anchor: null };
  }
  days.add(date);
  return { days, anchor: date };
}

/** The logs as the calendar should show them while editing. */
export function draftLogs(logs: readonly DayLog[], draft: PeriodDraft): DayLog[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  for (const d of draft.days) {
    const l = byDate.get(d);
    if (!l || !bleeding(l)) byDate.set(d, { ...(l ?? { date: d }), flow: 'medium' });
  }
  for (const [d, l] of byDate) {
    if (bleeding(l) && !draft.days.has(d)) {
      const next = { ...l };
      delete next.flow;
      delete next.periodEnd;
      byDate.set(d, next);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface DraftChanges {
  added: ISODate[];
  removed: ISODate[];
}

export function draftChanges(logs: readonly DayLog[], draft: PeriodDraft): DraftChanges {
  const before = draftFrom(logs).days;
  return {
    added: [...draft.days].filter((d) => !before.has(d)).sort(),
    removed: [...before].filter((d) => !draft.days.has(d)).sort(),
  };
}

/** Consecutive days as [start, end] runs. */
export function runs(days: Iterable<ISODate>): [ISODate, ISODate][] {
  const sorted = [...days].sort();
  const out: [ISODate, ISODate][] = [];
  for (const d of sorted) {
    const last = out[out.length - 1];
    if (last && addDays(last[1], 1) === d) last[1] = d;
    else out.push([d, d]);
  }
  return out;
}

export type DraftWarning =
  | { kind: 'long'; start: ISODate; end: ISODate; days: number }
  | { kind: 'close'; first: ISODate; second: ISODate; days: number }
  | { kind: 'single'; date: ISODate };

const LONG_PERIOD = 10;
const SHORT_CYCLE = 18;

/**
 * Things that look unlikely in the result: a period over 10 days, two starts less than 18 days
 * apart, a single day on its own. Only periods touched by the edit are checked.
 */
export function draftWarnings(draft: PeriodDraft, changes: DraftChanges): DraftWarning[] {
  const changed = new Set([...changes.added, ...changes.removed]);
  const all = runs(draft.days);
  const touched = (r: [ISODate, ISODate]) =>
    [...changed].some((d) => d >= addDays(r[0], -1) && d <= addDays(r[1], 1));
  const warnings: DraftWarning[] = [];
  all.forEach((r, i) => {
    const next = all[i + 1];
    if (next && (touched(r) || touched(next)) && diffDays(next[0], r[0]) < SHORT_CYCLE) {
      warnings.push({ kind: 'close', first: r[0], second: next[0], days: diffDays(next[0], r[0]) });
    }
    if (!touched(r)) return;
    const length = diffDays(r[1], r[0]) + 1;
    if (length > LONG_PERIOD) warnings.push({ kind: 'long', start: r[0], end: r[1], days: length });
    if (length === 1) warnings.push({ kind: 'single', date: r[0] });
  });
  return warnings;
}
