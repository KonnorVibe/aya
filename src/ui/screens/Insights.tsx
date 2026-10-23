import { createPortal } from 'react-dom';
import type { ISODate } from '../../engine/dates.ts';
import type { DayLog, Settings } from '../../engine/types.ts';
import { de, formatDayMonth, formatLongDate } from '../../i18n/de.ts';
import { BarChart } from '../components/BarChart.tsx';
import { Button } from '../components/Button.tsx';
import { TempChart } from '../components/TempChart.tsx';
import { accuracyTrend, type BacktestStep } from '../../engine/backtest.ts';
import { insightsModel, PERIOD_LIMIT } from './insightsModel.ts';
import './Insights.css';

const t = de.insights;

interface Props {
  logs: readonly DayLog[];
  settings: Settings;
  today: ISODate;
  onMethod: () => void;
  onLearn: () => void;
}

function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="row row-button" onClick={onClick}>
      <span>{label}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

export function Insights({ logs, settings, today, onMethod, onLearn }: Props) {
  const m = insightsModel(logs, settings, today);
  const s = m.stats;
  const cycleMax = Math.max(45, ...m.cycleBars.map((b) => b.value));
  const periodMax = Math.max(10, ...m.periodBars.map((b) => b.value));

  const hormonal = settings.mode === 'hormonal_contraception';
  const conceive = settings.mode === 'conceive';
  const temperature = hormonal ? null : (
    <section aria-labelledby="ins-temp">
      <h2 id="ins-temp">{t.temperature}</h2>
      {m.temperature.points.length >= 2 ? (
        <>
          <TempChart
            title={t.temperatureLabel(m.temperature.points.length)}
            points={m.temperature.points}
            coverline={m.temperature.coverline !== undefined ? { value: m.temperature.coverline, label: t.coverline } : undefined}
            ovulationDay={m.temperature.ovulationDay !== undefined ? { day: m.temperature.ovulationDay, label: t.ovulationMark } : undefined}
          />
          <p className="insights-note">
            {m.temperature.ovulationDate ? t.temperatureRise(formatDayMonth(m.temperature.ovulationDate)) : t.temperatureNoRise}
          </p>
        </>
      ) : (
        <p className="insights-note">{t.temperatureEmpty}</p>
      )}
    </section>
  );
  const patterns = (
    <section aria-labelledby="ins-patterns">
      <h2 id="ins-patterns">{t.patterns}</h2>
      {m.patterns.length ? (
        <ul className="insights-patterns">
          {m.patterns.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <p className="insights-note">{t.patternsEmpty}</p>
      )}
    </section>
  );

  return (
    <main className="insights">
      {/* One header line: the character, the title and what the page shows. */}
      <header className="insights-head">
        <span className="insights-kanji" lang="ja" aria-hidden="true">
          {t.kanji}
        </span>
        <div>
          <h1>{t.title}</h1>
          <p className="insights-subtitle">{t.subtitle}</p>
        </div>
      </header>

      <dl className="insights-figures">
        <div>
          <dt>{t.cycleLength}</dt>
          <dd>{s.medianLength !== undefined ? t.days(Math.round(s.medianLength)) : '–'}</dd>
        </div>
        <div>
          <dt>{t.range}</dt>
          <dd>{s.minLength !== undefined ? t.rangeValue(s.minLength, s.maxLength!) : '–'}</dd>
        </div>
        <div>
          <dt>{t.periodLength}</dt>
          <dd>{s.medianPeriodLength !== undefined ? t.days(Math.round(s.medianPeriodLength)) : '–'}</dd>
        </div>
        <div>
          <dt>{t.regularity}</dt>
          <dd>{t[s.regularity]}</dd>
        </div>
      </dl>
      <p className="insights-note">
        {s.regularity === 'unknown' ? t.regularityPending : t.regularityText(s.variation!, m.variabilityLimit)}
      </p>

      {/* Kinderwunsch: the temperature curve first; hormonal contraception: symptoms first. */}
      {conceive && temperature}
      {hormonal && patterns}

      <section aria-labelledby="ins-cycle">
        <h2 id="ins-cycle">{t.cycleLength}</h2>
        {m.cycleBars.length ? (
          <>
            <BarChart
              title={t.chartLabel(t.cycleLength, m.cycleBars.length)}
              bars={m.cycleBars}
              yMax={cycleMax}
              tone="luteal"
              band={{ from: 24, to: 38, label: t.normBand }}
            />
            <p className="insights-note">{t.cycleChartNote}</p>
          </>
        ) : (
          <p className="insights-note">{t.empty}</p>
        )}
      </section>

      {m.periodBars.length > 0 && (
        <section aria-labelledby="ins-period">
          <h2 id="ins-period">{t.periodLength}</h2>
          <BarChart
            title={t.chartLabel(t.periodLength, m.periodBars.length)}
            bars={m.periodBars}
            yMax={periodMax}
            tone="period"
            limit={{ value: PERIOD_LIMIT, label: t.periodLimit }}
          />
          <p className="insights-note">{t.periodChartNote}</p>
        </section>
      )}

      {!conceive && temperature}
      {!hormonal && patterns}


      <section aria-labelledby="ins-accuracy">
        <h2 id="ins-accuracy">{t.accuracy}</h2>
        <p className="insights-note">
          {m.accuracy
            ? t.accuracyText(m.accuracy.n, t.accuracyDays(m.accuracy.mae), Math.round(m.accuracy.coverage * m.accuracy.n))
            : t.accuracyPending}
        </p>
        {m.accuracy && <AccuracyHistory steps={m.accuracy.steps} />}
      </section>

      <section aria-labelledby="ins-print" className="insights-print">
        <h2 id="ins-print" className="visually-hidden">{t.print}</h2>
        <Button variant="secondary" onClick={() => window.print()}>
          {t.print}
        </Button>
        <p className="insights-note">{t.printHint}</p>
      </section>

      {createPortal(<PrintReport model={m} today={today} />, document.body)}

      {m.rows.length > 0 && (
        <details className="insights-table">
          <summary>{t.table}</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.tableStart}</th>
                <th scope="col">{t.tableCycle}</th>
                <th scope="col">{t.tablePeriod}</th>
              </tr>
            </thead>
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.start}>
                  <td>{formatDayMonth(r.start)}</td>
                  <td>
                    {r.cycle !== undefined ? t.days(r.cycle) : '–'}
                    {r.excluded && <span className="insights-excluded"> ({t.excluded})</span>}
                  </td>
                  <td>{t.days(r.period)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <section aria-labelledby="ins-more">
        <h2 id="ins-more">{t.more}</h2>
        <LinkRow label={de.method.title} onClick={onMethod} />
        <LinkRow label={de.method.learn} onClick={onLearn} />
      </section>
    </main>
  );
}

/**
 * Baustein 5: how far off aya was for each cycle, predicted only from the cycles before it, and
 * whether that got better. Bars are the absolute error; the line marks one day.
 */
function AccuracyHistory({ steps }: { steps: readonly BacktestStep[] }) {
  const trend = accuracyTrend(steps);
  const bars = steps.map((s) => ({
    key: s.start,
    label: `${Number(s.start.slice(8))}.${Number(s.start.slice(5, 7))}.`,
    value: Math.abs(s.error),
    description: t.accuracyStep(formatDayMonth(s.start), s.error),
    muted: !s.hit,
  }));
  return (
    <>
      {steps.length >= 2 && (
        <BarChart
          title={t.accuracyChart(steps.length)}
          bars={bars}
          yMax={Math.max(4, ...bars.map((b) => b.value))}
          tone="luteal"
          limit={{ value: 1, label: t.accuracyOneDay }}
        />
      )}
      {trend && <p className="insights-note">{t.accuracyTrend(t.accuracyDays(trend.early), t.accuracyDays(trend.recent), trend.count, trend.recent - trend.early)}</p>}
      <p className="insights-note">{t.accuracyChartNote}</p>
    </>
  );
}

/** Plain, printable summary for a doctor's appointment. Hidden on screen, shown only by window.print(). */
function PrintReport({ model: m, today }: { model: ReturnType<typeof insightsModel>; today: ISODate }) {
  const s = m.stats;
  return (
    <article className="print-report" aria-hidden="true">
      <h1>{t.printTitle}</h1>
      <p>{t.printCreated(formatLongDate(today))}</p>
      <dl>
        <dt>{t.cycleLength}</dt>
        <dd>{s.medianLength !== undefined ? t.days(Math.round(s.medianLength)) : '–'}</dd>
        <dt>{t.range}</dt>
        <dd>{s.minLength !== undefined ? t.rangeValue(s.minLength, s.maxLength!) : '–'}</dd>
        <dt>{t.periodLength}</dt>
        <dd>{s.medianPeriodLength !== undefined ? t.days(Math.round(s.medianPeriodLength)) : '–'}</dd>
        <dt>{t.regularity}</dt>
        <dd>{t[s.regularity]}</dd>
      </dl>
      {m.rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">{t.tableStart}</th>
              <th scope="col">{t.tableCycle}</th>
              <th scope="col">{t.tablePeriod}</th>
            </tr>
          </thead>
          <tbody>
            {m.rows.map((r) => (
              <tr key={r.start}>
                <td>{formatLongDate(r.start)}</td>
                <td>{r.cycle !== undefined ? t.days(r.cycle) : '–'}{r.excluded ? ` (${t.excluded})` : ''}</td>
                <td>{t.days(r.period)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>{t.patterns}</h2>
      {m.patterns.length ? <ul>{m.patterns.map((p) => <li key={p}>{p}</li>)}</ul> : <p>{t.patternsEmpty}</p>}
      <h2>{t.printHealth}</h2>
      {m.health.length ? <ul>{m.health.map((h) => <li key={h}>{de.notes.health[h]}</li>)}</ul> : <p>{t.printNoHealth}</p>}
      <p className="print-disclaimer">{de.disclaimer}</p>
    </article>
  );
}
