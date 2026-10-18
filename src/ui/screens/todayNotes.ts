import { deriveCycles } from '../../engine/cycles.ts';
import { diffDays, type ISODate } from '../../engine/dates.ts';
import { healthNotices, symptomPatterns, upcomingSymptoms } from '../../engine/insights.ts';
import type { Prediction } from '../../engine/prediction.ts';
import { overridesFrom, type DayLog, type Settings } from '../../engine/types.ts';
import { de, formatRange } from '../../i18n/de.ts';

const MAX_NOTES = 3;
const BACKUP_REMINDER_DAYS = 30;

/** Remind when the last backup (or, without one, the oldest entry) is more than 30 days old. */
export function backupDue(logs: readonly DayLog[], lastBackupAt: string | undefined, today: ISODate): boolean {
  const since = lastBackupAt?.slice(0, 10) ?? logs[0]?.date;
  return !!since && logs.length > 0 && diffDays(today, since) > BACKUP_REMINDER_DAYS;
}

/** Calm, ordered hints for the Today screen: what matters most first, at most three. */
export function todayNotes(
  prediction: Prediction,
  logs: readonly DayLog[],
  settings: Pick<Settings, 'mode' | 'birthYear' | 'includedCycles' | 'excludedCycles'>,
  today: ISODate,
  lastBackupAt?: string,
): string[] {
  const notes: string[] = [];
  const n = de.notes;
  if (prediction.lateByDays !== undefined) notes.push(n.late(prediction.lateByDays));
  if (prediction.suggestPregnancyTest) notes.push(n.pregnancyTest);
  if (prediction.basis === 'bbt' || prediction.basis === 'bbt+lh') notes.push(n.refinedBbt);
  if (prediction.basis === 'lh') notes.push(n.refinedLh);
  if (settings.mode === 'conceive' && prediction.fertileWindow && today <= prediction.fertileWindow.end) {
    notes.push(n.fertileWindow(formatRange(prediction.fertileWindow.start, prediction.fertileWindow.end)));
  }

  const past = logs.filter((l) => l.date <= today);
  const cycles = deriveCycles(past, { mode: settings.mode, overrides: overridesFrom(settings) });
  const age = settings.birthYear ? Number(today.slice(0, 4)) - settings.birthYear : undefined;
  for (const id of healthNotices(cycles, past, today, age)) notes.push(n.health[id]);
  if (backupDue(logs, lastBackupAt, today)) notes.push(lastBackupAt ? n.backup : n.backupNever);
  if (prediction.irregular && !notes.includes(n.health.high_variability)) notes.push(n.irregular);

  const upcoming = upcomingSymptoms(symptomPatterns(past, cycles), prediction, today);
  const names = [...new Set(upcoming.map((p) => de.symptomLabels[p.symptom]))].slice(0, 2);
  if (names.length) notes.push(n.upcoming(names.join(' und ')));

  return notes.slice(0, MAX_NOTES);
}

/** "mittel, Krämpfe, müde" for today's entry, or null when nothing is logged. */
export function logSummary(log: DayLog | undefined): string | null {
  if (!log) return null;
  const parts: string[] = [
    ...(log.flow ? [de.log.flows[log.flow]] : []),
    ...(log.symptoms ?? []).map((s) => de.symptomLabels[s]),
    ...(log.mood ?? []).map((m) => de.moodLabels[m]),
  ];
  if (log.energy) parts.push(`${de.log.energy} ${de.log.energyLevels[log.energy - 1]}`);
  if (log.sleepQuality) parts.push(`${de.log.sleep} ${de.log.sleepLevels[log.sleepQuality - 1]}`);
  if (log.sex?.length) parts.push(de.log.sex);
  if (log.note) parts.push(de.log.note);
  return parts.length ? parts.join(', ') : null;
}
