import { de } from '../../i18n/de.ts';
import './Legend.css';

const PHASES = [
  { key: 'period', cls: 'dot-period' },
  { key: 'fertile', cls: 'dot-fertile' },
  { key: 'ovulation', cls: 'dot-ovulation' },
  { key: 'luteal', cls: 'dot-luteal' },
] as const;

/** Key for the ring: phases on one row, forecast and the flow-size ramp on the next. */
/** Under hormonal contraception there are no cycle phases: only the bleed, called "Blutung". */
export function Legend({ showFertility = true, hormonal = false }: { showFertility?: boolean; hormonal?: boolean }) {
  const phases = PHASES.filter((i) => (showFertility || (i.key !== 'fertile' && i.key !== 'ovulation')) && !(hormonal && i.key === 'luteal'));
  return (
    <div className="legend">
      <ul>
        {phases.map((i) => (
          <li key={i.key}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <circle className={`dot ${i.cls}`} cx="6" cy="6" r="4" />
            </svg>
            {hormonal && i.key === 'period' ? de.legend.bleed : de.legend[i.key]}
          </li>
        ))}
      </ul>
      <ul>
        <li>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <circle className="dot dot-luteal is-predicted" cx="6" cy="6" r="4" />
          </svg>
          {de.legend.forecast}
        </li>
        <li>
          {de.legend.flow}: {de.legend.flowLight}
          <svg className="legend-ramp" viewBox="0 0 56 14" aria-hidden="true">
            {[2, 3, 4.5, 6].map((r, i) => (
              <circle key={r} className="dot dot-period" cx={[3, 12, 25, 43][i]} cy="7" r={r} />
            ))}
          </svg>
          {de.legend.flowHeavy}
        </li>
      </ul>
    </div>
  );
}
