import { useState } from 'react';
import { deriveCycles } from '../../engine/cycles.ts';
import { addDays, type ISODate } from '../../engine/dates.ts';
import type { Prediction } from '../../engine/prediction.ts';
import { overridesFrom, type DayLog, type Settings } from '../../engine/types.ts';
import { de, formatDayMonth, formatLongDate, formatMonthYear } from '../../i18n/de.ts';
import { Button } from '../components/Button.tsx';
import {
  calendarMonth,
  expectedPeriodLength,
  fromMonthIndex,
  monthIndex,
  predictedPeriodDays,
  type CalendarDay,
} from './calendarModel.ts';
import './Calendar.css';

const t = de.calendar;

interface Props {
  logs: readonly DayLog[];
  settings: Settings;
  prediction: Prediction | null;
  today: ISODate;
  onOpenDay: (date: ISODate) => void;
  onTogglePeriod: (date: ISODate) => void;
  onIncludeCycle: (start: ISODate) => void;
}

function dayLabel(d: CalendarDay): string {
  const s = t.states;
  const parts = [
    ...(d.isToday ? [s.today] : []),
    ...(d.period ? [s[d.period]] : []),
    ...(d.ovulation ? [s.ovulation] : d.fertility ? [s[d.fertility]] : []),
    ...(d.hasEntry ? [s.entry] : []),
  ];
  return t.dayLabel(formatLongDate(d.date), parts);
}

export function Calendar({ logs, settings, prediction, today, onOpenDay, onTogglePeriod, onIncludeCycle }: Props) {
  const [month, setMonth] = useState(() => monthIndex(today));
  const [editing, setEditing] = useState(false);
  const { year, month: m } = fromMonthIndex(month);

  const predicted = predictedPeriodDays(prediction, expectedPeriodLength(logs, settings), today);
  const weeks = calendarMonth(year, m, logs, prediction, predicted, today);
  const missed = deriveCycles(
    logs.filter((l) => l.date <= today),
    { mode: settings.mode, overrides: overridesFrom(settings) },
  ).filter((c) => c.excluded?.reason === 'possible_missed_log');

  const startAdding = (start: ISODate, length: number) => {
    setMonth(monthIndex(addDays(start, Math.round(length / 2))));
    setEditing(true);
  };

  return (
    <main className="calendar">
      <header className="calendar-head">
        <Button variant="quiet" className="calendar-nav" aria-label={t.prev} onClick={() => setMonth(month - 1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Button>
        <h1 aria-live="polite">{formatMonthYear(year, m)}</h1>
        <Button variant="quiet" className="calendar-nav" aria-label={t.next} onClick={() => setMonth(month + 1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </header>

      {!editing &&
        missed.map((c) => (
          <section key={c.startDate} className="calendar-missed" aria-live="polite">
            <p>{t.missed(formatDayMonth(c.startDate), formatDayMonth(c.endDate!), c.length!)}</p>
            <div>
              <Button variant="secondary" onClick={() => startAdding(c.startDate, c.length!)}>
                {t.missedAdd}
              </Button>
              <Button variant="quiet" onClick={() => onIncludeCycle(c.startDate)}>
                {t.missedKeep}
              </Button>
            </div>
          </section>
        ))}

      {editing && <p className="calendar-edit-hint">{t.editHint}</p>}

      <table className={editing ? 'calendar-grid is-editing' : 'calendar-grid'} role="grid">
        <thead>
          <tr>
            {t.weekdays.map((w) => (
              <th key={w} scope="col">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]!.date}>
              {week.map((d) => (
                <td key={d.date}>
                  <button
                    type="button"
                    className={[
                      'cal-day',
                      !d.inMonth && 'is-outside',
                      d.isToday && 'is-today',
                      d.period && `is-${d.period}`,
                      d.fertility && `is-${d.fertility}`,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={editing && d.future}
                    aria-label={dayLabel(d)}
                    aria-pressed={editing ? d.period === 'logged' : undefined}
                    onClick={() => (editing ? onTogglePeriod(d.date) : onOpenDay(d.date))}
                  >
                    <span className="cal-num">{d.day}</span>
                    <span className="cal-marks" aria-hidden="true">
                      {d.ovulation ? <i className="mark-ovulation" /> : d.fertility && <i className="mark-fertile" />}
                      {d.hasEntry && <i className="mark-entry" />}
                    </span>
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="calendar-legend">
        <li>
          <i className="sw-logged" aria-hidden="true" />
          {de.legend.period}
        </li>
        <li>
          <i className="sw-predicted" aria-hidden="true" />
          {t.legendPredicted}
        </li>
        {prediction?.fertileWindow && (
          <>
            <li>
              <i className="mark-fertile" aria-hidden="true" />
              {de.legend.fertile}
            </li>
            <li>
              <i className="mark-ovulation" aria-hidden="true" />
              {de.legend.ovulation}
            </li>
          </>
        )}
        <li>
          <i className="mark-entry" aria-hidden="true" />
          {t.legendEntry}
        </li>
      </ul>

      <div className="calendar-actions">
        {editing ? (
          <Button onClick={() => setEditing(false)}>{t.editDone}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t.edit}
            </Button>
            {month !== monthIndex(today) && (
              <Button variant="quiet" onClick={() => setMonth(monthIndex(today))}>
                {t.toToday}
              </Button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
