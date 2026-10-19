import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  /** Opens directly in back-entry mode at this flagged cycle (from the card on Today). */
  focus?: { start: ISODate; length: number } | undefined;
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

/** Months shown in the scroll list: at least a year back and ahead, and back to the first entry. */
function monthSpan(logs: readonly DayLog[], today: ISODate, extra: number): number[] {
  const now = monthIndex(today);
  const firstLog = logs.reduce<number>((min, l) => Math.min(min, monthIndex(l.date)), now);
  const first = Math.min(now - 12, firstLog, extra);
  const last = Math.max(now + 12, extra);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

export function Calendar({ logs, settings, prediction, today, onOpenDay, onTogglePeriod, onIncludeCycle, focus }: Props) {
  const [month, setMonth] = useState(() => monthIndex(focus ? addDays(focus.start, Math.round(focus.length / 2)) : today));
  const [editing, setEditing] = useState(!!focus);
  const { year, month: m } = fromMonthIndex(month);
  const refs = useRef(new Map<number, HTMLElement>());
  // Set while a jump scrolls, so the observer does not report the months it passes.
  const jumping = useRef(false);

  const predicted = predictedPeriodDays(prediction, expectedPeriodLength(logs, settings), today);
  const months = monthSpan(logs, today, month);
  const missed = deriveCycles(
    logs.filter((l) => l.date <= today),
    { mode: settings.mode, overrides: overridesFrom(settings) },
  ).filter((c) => c.excluded?.reason === 'possible_missed_log');

  const scrollTo = useCallback((index: number, smooth: boolean) => {
    setMonth(index);
    const el = refs.current.get(index);
    if (!el?.scrollIntoView) return;
    jumping.current = true;
    el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'instant' });
    window.setTimeout(() => (jumping.current = false), smooth ? 600 : 50);
  }, []);

  // Open at the current (or focused) month.
  const initial = useRef(month);
  useLayoutEffect(() => scrollTo(initial.current, false), [scrollTo]);

  // The heading follows the month in view while scrolling.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (jumping.current) return;
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setMonth(Number((hit.target as HTMLElement).dataset.month));
      },
      { rootMargin: '-35% 0px -60% 0px' },
    );
    refs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [months.length]);

  const startAdding = (start: ISODate, length: number) => {
    scrollTo(monthIndex(addDays(start, Math.round(length / 2))), true);
    setEditing(true);
  };

  return (
    <main className="calendar">
      <div className="calendar-sticky">
        <header className="calendar-head">
          <Button variant="quiet" className="calendar-nav" aria-label={t.prev} onClick={() => scrollTo(month - 1, true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Button>
          <h1 aria-live="polite">{formatMonthYear(year, m)}</h1>
          <Button variant="quiet" className="calendar-nav" aria-label={t.next} onClick={() => scrollTo(month + 1, true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </header>
        <div className="calendar-actions">
          {editing ? (
            <Button onClick={() => setEditing(false)}>{t.editDone}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                {t.edit}
              </Button>
              {month !== monthIndex(today) && (
                <Button variant="quiet" onClick={() => scrollTo(monthIndex(today), true)}>
                  {t.toToday}
                </Button>
              )}
            </>
          )}
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {t.weekdays.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
      </div>

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

      {months.map((index) => {
        const ym = fromMonthIndex(index);
        const weeks = calendarMonth(ym.year, ym.month, logs, prediction, predicted, today);
        const name = formatMonthYear(ym.year, ym.month);
        return (
          <section
            key={index}
            className="calendar-month"
            data-month={index}
            aria-label={name}
            ref={(el) => {
              if (el) refs.current.set(index, el);
              else refs.current.delete(index);
            }}
          >
            <h2 className="calendar-month-name">{name}</h2>
            <table className={editing ? 'calendar-grid is-editing' : 'calendar-grid'} role="grid" aria-label={name}>
              <thead className="visually-hidden">
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
                        {d.inMonth && (
                          <button
                            type="button"
                            className={[
                              'cal-day',
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
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
