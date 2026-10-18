import { Brand } from '../components/Brand.tsx';
import { deriveCycles } from '../../engine/cycles.ts';
import type { ISODate } from '../../engine/dates.ts';
import type { Prediction } from '../../engine/prediction.ts';
import { overridesFrom, type DayLog, type Settings } from '../../engine/types.ts';
import { confidenceLabel, de, formatDayMonth, formatLongDate, formatRange, statement } from '../../i18n/de.ts';
import { Button } from '../components/Button.tsx';
import { CycleRing } from '../components/CycleRing.tsx';
import { Legend } from '../components/Legend.tsx';
import { ringModel } from '../components/ringModel.ts';
import { logSummary, todayNotes } from './todayNotes.ts';
import './Today.css';

const shortDay = (d: ISODate) => `${Number(d.slice(8))}.`;

interface Props {
  prediction: Prediction | null;
  logs: readonly DayLog[];
  settings: Pick<Settings, 'mode' | 'birthYear' | 'includedCycles' | 'excludedCycles'>;
  today: ISODate;
  lastBackupAt?: string | undefined;
  onPeriodStart: () => void;
  onPeriodEnd: () => void;
  onLog: () => void;
  /** "Periode nachtragen" on the missed-period card. */
  onAddMissed: (start: ISODate, length: number) => void;
  onIncludeCycle: (start: ISODate) => void;
}

export function Today({ prediction, logs, settings, today, lastBackupAt, onPeriodStart, onPeriodEnd, onLog, onAddMissed, onIncludeCycle }: Props) {
  const summary = logSummary(logs.find((l) => l.date === today));
  if (!prediction) {
    return (
      <main className="today">
        <header className="today-head">
          <Brand />
          <span>{formatLongDate(today)}</span>
        </header>
        <section className="today-statement today-empty">
          <h1>{de.emptyToday.title}</h1>
          <p>{de.emptyToday.body}</p>
        </section>
        <div className="today-actions">
          <Button onClick={onPeriodStart}>{de.periodStarted}</Button>
          <Button variant="secondary" onClick={onLog}>
            {de.logToday}
          </Button>
        </div>
        {summary && <TodaySummary text={summary} />}
      </main>
    );
  }
  const notes = todayNotes(prediction, logs, settings, today, lastBackupAt);
  const model = ringModel(prediction, logs, today);
  const range = formatRange(prediction.nextPeriod.earliest, prediction.nextPeriod.latest);
  // Once "Periode beendet" was tapped, the button offers a new start again.
  const ended = logs.some((l) => l.periodEnd && l.date >= prediction.cycleStart);
  const inPeriod = prediction.periodDay !== undefined && !ended;
  return (
    <main className="today">
      <header className="today-head">
        <Brand />
        <span>{formatLongDate(today)}</span>
      </header>

      <section className="today-statement" aria-live="polite">
        <h1>{statement(prediction, today)}</h1>
        <p>
          {de.expected} {range}
          <br />
          {confidenceLabel[prediction.confidence]}
        </p>
      </section>

      <figure className="today-chart">
        <CycleRing
          model={model}
          cycleDay={prediction.cycleDay}
          dayCaption={de.cycleDayOf(model.length)}
          label={de.ringLabel(prediction.cycleDay, model.length, range)}
          rangeLabels={[shortDay(prediction.nextPeriod.earliest), shortDay(prediction.nextPeriod.latest)]}
        />
        <figcaption>
          <Legend showFertility={!!prediction.fertileWindow} />
        </figcaption>
      </figure>

      <div className="today-actions">
        <Button onClick={inPeriod ? onPeriodEnd : onPeriodStart}>{inPeriod ? de.periodEnded : de.periodStarted}</Button>
        <Button variant="secondary" onClick={onLog}>
          {de.logToday}
        </Button>
      </div>

      {summary && <TodaySummary text={summary} />}

      <MissedCards logs={logs} settings={settings} today={today} onAdd={onAddMissed} onInclude={onIncludeCycle} />

      {notes.length > 0 && (
        <ul className="today-notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

function TodaySummary({ text }: { text: string }) {
  return (
    <p className="today-summary">
      <span>{de.log.summary}</span> {text}
    </p>
  );
}

/** Asks about cycles that look like a forgotten period (Li et al. 2022) where it is seen most: here. */
function MissedCards({ logs, settings, today, onAdd, onInclude }: {
  logs: readonly DayLog[];
  settings: Props['settings'];
  today: ISODate;
  onAdd: Props['onAddMissed'];
  onInclude: Props['onIncludeCycle'];
}) {
  const missed = deriveCycles(logs.filter((l) => l.date <= today), { mode: settings.mode, overrides: overridesFrom(settings) })
    .filter((c) => c.excluded?.reason === 'possible_missed_log');
  if (!missed.length) return null;
  const t = de.calendar;
  return (
    <>
      {missed.map((c) => (
        <section key={c.startDate} className="today-missed" aria-live="polite">
          <p>{t.missed(formatDayMonth(c.startDate), formatDayMonth(c.endDate!), c.length!)}</p>
          <div>
            <Button variant="secondary" onClick={() => onAdd(c.startDate, c.length!)}>
              {t.missedAdd}
            </Button>
            <Button variant="quiet" onClick={() => onInclude(c.startDate)}>
              {t.missedKeep}
            </Button>
          </div>
        </section>
      ))}
    </>
  );
}
