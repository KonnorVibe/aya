import type { CSSProperties } from 'react';
import { de } from '../../i18n/de.ts';
import type { RingDay, RingModel } from './ringModel.ts';
import './CycleRing.css';

const SIZE = 300;
const C = SIZE / 2;
const ORBIT = 118;
const RANGE_ORBIT = 136;
const LABEL_ORBIT = ORBIT - 30;

/** Dot radius on a fixed magnitude ramp: flow first, then phase importance. */
export function dotRadius(day: Pick<RingDay, 'magnitude' | 'kind'>): number {
  if (day.magnitude) return [0, 3, 4.5, 6, 7.5][day.magnitude]!;
  if (day.kind === 'ovulation') return 5.5;
  if (day.kind === 'peak') return 4.5;
  if (day.kind === 'fertile') return 3.5;
  return 2.5;
}

function point(offset: number, length: number, r: number) {
  const a = -Math.PI / 2 + (2 * Math.PI * offset) / length;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

function arcPath(from: number, to: number, length: number, r: number): string {
  const a = point(from, length, r);
  const b = point(to, length, r);
  const large = (to - from) / length > 0.5 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

type Group = 'period' | 'fertile' | 'luteal';
const groupOf = (d: RingDay): Group | null =>
  d.kind === 'period' ? 'period' : d.kind === 'luteal' ? 'luteal' : d.kind === 'fertile' || d.kind === 'peak' || d.kind === 'ovulation' ? 'fertile' : null;

/** Consecutive runs of one phase, so each gets a name on the chart (colour is never the only signal). */
function phaseRuns(days: readonly RingDay[]) {
  const runs: { group: Group; from: number; to: number }[] = [];
  for (const d of days) {
    const g = groupOf(d);
    const last = runs[runs.length - 1];
    if (g && last?.group === g && last.to === d.offset - 1) last.to = d.offset;
    else if (g) runs.push({ group: g, from: d.offset, to: d.offset });
  }
  return runs.filter((r) => r.to - r.from >= 2);
}

interface Props {
  model: RingModel;
  cycleDay: number;
  label: string;
  dayCaption: string;
  rangeLabels: [string, string];
}

/**
 * The cycle as a star chart: one point per day on a hairline orbit with cardinal graticule ticks. Size encodes
 * flow, colour and a written name the phase, hollow points are forecast, the amber reticle marks
 * today. The dashed outer arc is the 80 % range for the next period, its ends ticked and dated.
 */
export function CycleRing({ model, cycleDay, label, dayCaption, rangeLabels }: Props) {
  const { length, days, range } = model;
  const today = days.find((d) => d.isToday);
  const weekTicks = Array.from({ length: Math.floor(length / 7) + 1 }, (_, i) => i * 7).filter((o) => o < length);

  return (
    <svg className="ring" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
      <g className="ring-graticule" aria-hidden="true">
        {/* Cardinal crosshair ticks across the orbit; kept short so they never cross the type. */}
        <line x1={C - ORBIT - 14} y1={C} x2={C - ORBIT + 14} y2={C} />
        <line x1={C + ORBIT - 14} y1={C} x2={C + ORBIT + 14} y2={C} />
        <line x1={C} y1={C - ORBIT - 14} x2={C} y2={C - ORBIT + 14} />
        <line x1={C} y1={C + ORBIT - 14} x2={C} y2={C + ORBIT + 14} />
        <circle cx={C} cy={C} r={ORBIT} />
        {weekTicks.map((o) => {
          const a = point(o, length, ORBIT + 5);
          const b = point(o, length, ORBIT + 10);
          return <line key={o} className="ring-week" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>

      <g className="ring-range" aria-hidden="true">
        <path d={arcPath(range.earliest, range.latest, length, RANGE_ORBIT)} />
        {[range.earliest, range.latest].map((o, i) => {
          const a = point(o, length, RANGE_ORBIT - 4);
          const b = point(o, length, RANGE_ORBIT + 4);
          const t = point(o, length, RANGE_ORBIT + 13);
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <text x={t.x} y={t.y + 4} textAnchor={i === 0 ? 'end' : 'start'}>
                {rangeLabels[i]}
              </text>
            </g>
          );
        })}
      </g>

      {days.map((day) => {
        const p = point(day.offset, length, ORBIT);
        const style = { '--i': day.offset } as CSSProperties;
        return (
          <circle
            key={day.date}
            className={`ring-day dot dot-${day.kind}${day.predicted ? ' is-predicted' : ''}`}
            style={style}
            cx={p.x}
            cy={p.y}
            r={dotRadius(day)}
          />
        );
      })}

      <g className="ring-names" aria-hidden="true">
        {phaseRuns(days).map((r) => {
          const p = point((r.from + r.to) / 2, length, LABEL_ORBIT);
          // Grow the name towards the centre so it never runs into the orbit or the reticle.
          const anchor = Math.abs(p.x - C) < 30 ? 'middle' : p.x < C ? 'start' : 'end';
          return (
            <text key={r.from} className={`name-${r.group}`} x={p.x} y={p.y + 4} textAnchor={anchor}>
              {de.ringPhase[r.group]}
            </text>
          );
        })}
      </g>

      {today && (() => {
        const p = point(today.offset, length, ORBIT);
        const r = dotRadius(today) + 6;
        return (
          <g className="ring-reticle" aria-hidden="true">
            <circle cx={p.x} cy={p.y} r={r} />
            <path d={`M${p.x - r - 5} ${p.y}h5 M${p.x + r} ${p.y}h5 M${p.x} ${p.y - r - 5}v5 M${p.x} ${p.y + r}v5`} />
          </g>
        );
      })()}

      <text className="ring-day-number" x={C} y={C + 2} textAnchor="middle">
        {cycleDay}
      </text>
      <text className="ring-caption" x={C} y={C + 26} textAnchor="middle">
        {dayCaption}
      </text>
    </svg>
  );
}
