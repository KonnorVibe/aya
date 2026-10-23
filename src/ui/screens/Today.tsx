import { Brand } from '../components/Brand.tsx';
import { deriveCycles } from '../../engine/cycles.ts';
import type { ISODate } from '../../engine/dates.ts';
import type { Prediction } from '../../engine/prediction.ts';
import { overridesFrom, type DayLog, type Settings } from '../../engine/types.ts';
import { de, formatDayMonth, formatLongDate, formatRange, statement } from '../../i18n/de.ts';
import { Button } from '../components/Button.tsx';
import { CycleRing } from '../components/CycleRing.tsx';
import { Legend } from '../components/Legend.tsx';
import { emptyRingModel, ringModel } from '../components/ringModel.ts';
import { phaseQuote } from './phaseQuote.ts';
import { focusModel, type Focus } from './focusModel.ts';
import { ConfidenceDonut, confidencePercent, FULL_CYCLES } from '../components/ConfidenceDonut.tsx';
import { logSummary, todayNotes } from './todayNotes.ts';
import './Today.css';

const shortDay = (d: ISODate) => `${Number(d.slice(8))}.`;

interface Props {
  prediction: Prediction | null;
  logs: readonly DayLog[];
  settings: Pick<Settings, 'mode' | 'birthYear' | 'includedCycles' | 'excludedCycles' | 'defaultPeriodLength'>;
  today: ISODate;
  lastBackupAt?: string | undefined;
  onPeriodStart: () => void;
  onPeriodEnd: () => void;
  onLog: () => void;
  /** "Periode nachtragen" on the missed-period card. */
  onAddMissed: (start: ISODate, length: number) => void;
  onIncludeCycle: (start: ISODate) => void;
  /** "Alte Daten importieren" on the empty screen. */
  onImport: () => void;
  /** The logo opens Methodik und Quellen. */
  onMethod: () => void;
}

export function Today({ prediction, logs, settings, today, lastBackupAt, onPeriodStart, onPeriodEnd, onLog, onAddMissed, onIncludeCycle, onImport, onMethod }: Props) {
  const head = (
    <header className="today-head">
      <button type="button" className="today-brand" aria-label={de.method.title} onClick={onMethod}>
        <Brand />
      </button>
      <span>{formatLongDate(today)}</span>
    </header>
  );
  const hormonal = settings.mode === 'hormonal_contraception';
  const conceive = settings.mode === 'conceive';
  const startLabel = hormonal ? de.bleedStarted : de.periodStarted;
  const endLabel = hormonal ? de.bleedEnded : de.periodEnded;
  const summary = logSummary(logs.find((l) => l.date === today));
  if (!prediction) {
    return (
      <main className="today">
        {head}
        <section className="today-statement today-empty">
          <h1>{de.emptyToday.title}</h1>
          <p>{de.emptyToday.body}</p>
        </section>
        <figure className="today-chart is-empty">
          <CycleRing model={emptyRingModel(today)} label={de.emptyToday.ring} dayCaption={de.emptyToday.ringCaption} />
        </figure>
        <div className="today-actions">
          <Button onClick={onPeriodStart}>{startLabel}</Button>
          <Button variant="secondary" onClick={onLog}>
            {de.logToday}
          </Button>
        </div>
        <div className="today-import">
          <Button variant="quiet" onClick={onImport}>
            {de.emptyToday.import}
          </Button>
          <p>{de.emptyToday.importHint}</p>
        </div>
        {summary && <TodaySummary text={summary} />}
      </main>
    );
  }
  const notes = todayNotes(prediction, logs, settings, today, lastBackupAt);
  const quote = phaseQuote(prediction, today, settings.mode);
  const focus = focusModel(prediction, logs, settings, today);
  const percent = confidencePercent(prediction);
  const model = ringModel(prediction, logs, today);
  const range = formatRange(prediction.nextPeriod.earliest, prediction.nextPeriod.latest);
  // Once "Periode beendet" was tapped, the button offers a new start again.
  const ended = logs.some((l) => l.periodEnd && l.date >= prediction.cycleStart);
  const inPeriod = prediction.periodDay !== undefined && !ended;
  return (
    <main className="today">
      {head}

      <figure className={`today-quote quote-${quote.phase}`}>
        <figcaption>
          <i aria-hidden="true" />
          {de.quotePhase[quote.phase]}
        </figcaption>
        <p>{quote.text}</p>
      </figure>

      <section className="today-statement" aria-live="polite">
        <div>
          <h1>{statement(prediction, today, settings.mode)}</h1>
          <p>
            {conceive ? de.expectedPeriod : hormonal ? de.expectedBleed : de.expected} {range}
          </p>
        </div>
        <figure className="today-confidence">
          <ConfidenceDonut percent={percent} label={de.confidence.label(percent, Math.min(prediction.usedCycles, FULL_CYCLES), FULL_CYCLES)} />
          <figcaption aria-hidden="true">{de.confidence.caption(Math.min(prediction.usedCycles, FULL_CYCLES), FULL_CYCLES)}</figcaption>
        </figure>
      </section>

      <figure className="today-chart">
        <CycleRing
          model={model}
          cycleDay={prediction.cycleDay}
          dayCaption={de.cycleDayOf(model.length)}
          label={de.ringLabel(prediction.cycleDay, model.length, range)}
          rangeLabels={[shortDay(prediction.nextPeriod.earliest), shortDay(prediction.nextPeriod.latest)]}
          phaseNames={hormonal ? de.ringPhaseHormonal : de.ringPhase}
          focus={focus.kind === 'fertile' ? 'fertile' : 'next'}
        />
        <figcaption>
          <Legend showFertility={!!prediction.fertileWindow} hormonal={hormonal} />
        </figcaption>
      </figure>

      <div className="today-actions">
        {/* Kinderwunsch: logging temperature and tests is the daily task, so it comes first. */}
        {conceive && !inPeriod ? (
          <>
            <Button onClick={onLog}>{de.logToday}</Button>
            <Button variant="secondary" onClick={onPeriodStart}>
              {startLabel}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={inPeriod ? onPeriodEnd : onPeriodStart}>{inPeriod ? endLabel : startLabel}</Button>
            <Button variant="secondary" onClick={onLog}>
              {de.logToday}
            </Button>
          </>
        )}
      </div>

      <FocusCard focus={focus} />

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

/** What the mode is about, with the few facts that help now. */
function FocusCard({ focus }: { focus: Focus }) {
  return (
    <section className={`today-focus focus-${focus.kind}`} aria-labelledby="today-focus-title">
      <h2 id="today-focus-title">{focus.title}</h2>
      <p className="today-focus-headline">{focus.headline}</p>
      <ul>
        {focus.rows.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
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
