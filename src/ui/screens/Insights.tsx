import type { ISODate } from '../../engine/dates.ts';
import type { DayLog, Settings } from '../../engine/types.ts';
import { de, formatDayMonth } from '../../i18n/de.ts';
import { BarChart } from '../components/BarChart.tsx';
import { insightsModel, PERIOD_LIMIT } from './insightsModel.ts';
import './Insights.css';

const t = de.insights;

interface Props {
  logs: readonly DayLog[];
  settings: Settings;
  today: ISODate;
}

export function Insights({ logs, settings, today }: Props) {
  const m = insightsModel(logs, settings, today);
  const s = m.stats;
  const cycleMax = Math.max(45, ...m.cycleBars.map((b) => b.value));
  const periodMax = Math.max(10, ...m.periodBars.map((b) => b.value));

  return (
    <main className="insights">
      <h1>{t.title}</h1>

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
    </main>
  );
}
