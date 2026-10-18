import { figoVariabilityLimit, FIGO_MAX_PERIOD_LENGTH } from '../../engine/constants.ts';
import { backtest, type BacktestResult } from '../../engine/backtest.ts';
import { deriveCycles } from '../../engine/cycles.ts';
import { detectBbtShift } from '../../engine/ovulation.ts';
import { diffDays, type ISODate } from '../../engine/dates.ts';
import { cycleStats, healthNotices, symptomPatterns, type CycleStats, type HealthNoticeId } from '../../engine/insights.ts';
import { overridesFrom, type DayLog, type Settings } from '../../engine/types.ts';
import { de, formatDayMonth } from '../../i18n/de.ts';
import type { Bar } from '../components/BarChart.tsx';
import type { TempPoint } from '../components/TempChart.tsx';

const SHOWN_CYCLES = 12;
const SHOWN_PATTERNS = 5;
const t = de.insights;

export interface InsightsModel {
  stats: CycleStats;
  variabilityLimit: number;
  cycleBars: Bar[];
  periodBars: Bar[];
  patterns: string[];
  rows: { start: ISODate; cycle?: number; period: number; excluded: boolean }[];
  /** Basal temperature of the running cycle (mode-independent; hidden under hormonal contraception). */
  temperature: { points: TempPoint[]; coverline?: number; ovulationDate?: ISODate; ovulationDay?: number };
  accuracy: BacktestResult | null;
  health: HealthNoticeId[];
}

const shortDate = (d: ISODate) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;

export function insightsModel(
  logs: readonly DayLog[],
  settings: Pick<Settings, 'mode' | 'birthYear' | 'includedCycles' | 'excludedCycles' | 'defaultCycleLength'>,
  today: ISODate,
): InsightsModel {
  const past = logs.filter((l) => l.date <= today);
  const cycles = deriveCycles(past, { mode: settings.mode, overrides: overridesFrom(settings) });
  const age = settings.birthYear ? Number(today.slice(0, 4)) - settings.birthYear : undefined;
  const completed = cycles.filter((c) => c.length !== undefined).slice(-SHOWN_CYCLES);
  // Periods that are over: every completed cycle plus the current one once its bleeding has stopped.
  const periods = cycles.filter((c) => c.periodEnd < today).slice(-SHOWN_CYCLES);

  const cycleBars: Bar[] = completed.map((c) => ({
    key: c.startDate,
    label: shortDate(c.startDate),
    value: c.length!,
    muted: !!c.excluded,
    description: t.selected(formatDayMonth(c.startDate), t.days(c.length!) + (c.excluded ? ` (${t.excluded})` : '')),
  }));
  const periodBars: Bar[] = periods.map((c) => ({
    key: c.startDate,
    label: shortDate(c.startDate),
    value: c.periodLength,
    description: t.selected(formatDayMonth(c.startDate), t.days(c.periodLength)),
  }));

  const patterns = symptomPatterns(past, cycles)
    .slice(0, SHOWN_PATTERNS)
    .map((p) => t.pattern(p.cyclesWith, p.cyclesTotal, t.phases[p.phase], de.symptomLabels[p.symptom]));

  const current = cycles[cycles.length - 1];
  const running = current ? past.filter((l) => l.date >= current.startDate && l.bbt) : [];
  const points: TempPoint[] = running.map((l) => {
    const day = diffDays(l.date, current!.startDate) + 1;
    const disturbed = !!l.bbt!.disturbed;
    return {
      date: l.date,
      day,
      value: l.bbt!.value,
      disturbed,
      description: t.temperatureReading(formatDayMonth(l.date), day, l.bbt!.value.toFixed(2).replace('.', ','), disturbed),
    };
  });
  const shift = settings.mode === 'hormonal_contraception' ? null : detectBbtShift(running);
  const temperature: InsightsModel['temperature'] = { points };
  if (shift && current) {
    temperature.coverline = shift.coverline;
    temperature.ovulationDate = shift.ovulationDate;
    temperature.ovulationDay = diffDays(shift.ovulationDate, current.startDate) + 1;
  }

  return {
    temperature,
    accuracy: backtest(cycles, { ...(settings.defaultCycleLength !== undefined ? { prior: settings.defaultCycleLength } : {}), ...(age !== undefined ? { age } : {}) }),
    health: healthNotices(cycles, past, today, age),
    stats: cycleStats(cycles, age),
    variabilityLimit: figoVariabilityLimit(age),
    cycleBars,
    periodBars,
    patterns,
    rows: [...periods].reverse().map((c) => ({
      start: c.startDate,
      ...(c.length !== undefined ? { cycle: c.length } : {}),
      period: c.periodLength,
      excluded: !!c.excluded,
    })),
  };
}

export const PERIOD_LIMIT = FIGO_MAX_PERIOD_LENGTH;
