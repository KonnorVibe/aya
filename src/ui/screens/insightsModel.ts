import { figoVariabilityLimit, FIGO_MAX_PERIOD_LENGTH } from '../../engine/constants.ts';
import { deriveCycles } from '../../engine/cycles.ts';
import type { ISODate } from '../../engine/dates.ts';
import { cycleStats, symptomPatterns, type CycleStats } from '../../engine/insights.ts';
import { overridesFrom, type DayLog, type Settings } from '../../engine/types.ts';
import { de, formatDayMonth } from '../../i18n/de.ts';
import type { Bar } from '../components/BarChart.tsx';

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
}

const shortDate = (d: ISODate) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;

export function insightsModel(
  logs: readonly DayLog[],
  settings: Pick<Settings, 'mode' | 'birthYear' | 'includedCycles' | 'excludedCycles'>,
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

  return {
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
