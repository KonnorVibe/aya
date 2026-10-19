import { addDays, diffDays, type ISODate } from '../../engine/dates.ts';
import type { Prediction } from '../../engine/prediction.ts';
import type { DayLog, Flow } from '../../engine/types.ts';

export type RingDayKind = 'period' | 'fertile' | 'peak' | 'ovulation' | 'luteal' | 'follicular' | 'neutral';

export interface RingDay {
  offset: number;
  date: ISODate;
  kind: RingDayKind;
  /** 0 = no flow, 1 spotting … 4 heavy. Drives dot size. */
  magnitude: 0 | 1 | 2 | 3 | 4;
  /** After today: drawn hollow, it is a forecast. */
  predicted: boolean;
  isToday: boolean;
}

export interface RingModel {
  length: number;
  days: RingDay[];
  /** Next-period range as offsets from cycle start (may exceed length); null before any data. */
  range: { earliest: number; latest: number } | null;
}

/** A quiet placeholder ring for the first start: a typical cycle, no phases, no forecast. */
export function emptyRingModel(today: ISODate, length = 28): RingModel {
  const days: RingDay[] = Array.from({ length }, (_, offset) => ({
    offset,
    date: addDays(today, offset),
    kind: 'neutral',
    magnitude: 0,
    predicted: true,
    isToday: false,
  }));
  return { length, days, range: null };
}

const FLOW_MAGNITUDE: Record<Flow, 1 | 2 | 3 | 4> = { spotting: 1, light: 2, medium: 3, heavy: 4 };

/** Maps a prediction and the current cycle's logs to ring dots. Pure, so it is unit-tested. */
export function ringModel(prediction: Prediction, logs: readonly DayLog[], today: ISODate): RingModel {
  const start = prediction.cycleStart;
  const length = Math.max(diffDays(prediction.nextPeriod.mostLikely, start), prediction.cycleDay);
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const w = prediction.fertileWindow;
  const ov = prediction.ovulation?.mostLikely;

  const days: RingDay[] = Array.from({ length }, (_, offset) => {
    const date = addDays(start, offset);
    const flow = byDate.get(date)?.flow;
    let kind: RingDayKind;
    if (flow && flow !== 'spotting') kind = 'period';
    else if (!w || !ov) kind = 'neutral';
    else if (date === ov) kind = 'ovulation';
    else if (date >= w.peakStart && date <= w.peakEnd) kind = 'peak';
    else if (date >= w.start && date <= w.end) kind = 'fertile';
    else kind = date > ov ? 'luteal' : 'follicular';
    return {
      offset,
      date,
      kind,
      magnitude: flow ? FLOW_MAGNITUDE[flow] : 0,
      predicted: date > today,
      isToday: date === today,
    };
  });

  return {
    length,
    days,
    range: {
      earliest: diffDays(prediction.nextPeriod.earliest, start),
      latest: diffDays(prediction.nextPeriod.latest, start),
    },
  };
}
