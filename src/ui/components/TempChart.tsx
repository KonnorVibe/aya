import { useState } from 'react';
import type { ISODate } from '../../engine/dates.ts';
import './TempChart.css';

export interface TempPoint {
  date: ISODate;
  /** 1-based cycle day. */
  day: number;
  value: number;
  disturbed: boolean;
  description: string;
}

interface Props {
  title: string;
  points: readonly TempPoint[];
  /** Coverline of a detected 3-over-6 rise. */
  coverline?: { value: number; label: string } | undefined;
  /** Cycle day of the (confirmed) ovulation. */
  ovulationDay?: { day: number; label: string } | undefined;
}

const W = 340;
const H = 176;
const PAD = { top: 14, right: 10, bottom: 22, left: 34 };

/**
 * Basal temperature of the current cycle: a line through the valid readings, disturbed readings
 * as hollow dots off the line, the coverline dashed, ovulation as a vertical accent. Tap a dot.
 */
export function TempChart({ title, points, coverline, ovulationDay }: Props) {
  const [active, setActive] = useState(points.length - 1);
  const values = [...points.map((p) => p.value), ...(coverline ? [coverline.value] : [])];
  const lo = Math.floor((Math.min(...values) - 0.1) * 10) / 10;
  const hi = Math.ceil((Math.max(...values) + 0.1) * 10) / 10;
  const lastDay = Math.max(28, ...points.map((p) => p.day));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (day: number) => PAD.left + ((day - 1) / Math.max(lastDay - 1, 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / Math.max(hi - lo, 0.1)) * plotH;
  const step = hi - lo > 1 ? 0.2 : 0.1;
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => Math.round((lo + i * step) * 100) / 100);
  const dayTicks = [1, 7, 14, 21, 28, ...(lastDay > 30 ? [lastDay] : [])].filter((d) => d <= lastDay);
  const valid = points.filter((p) => !p.disturbed);
  const line = valid.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
  const current = points[active];

  return (
    <figure className="tempchart">
      <p className="tempchart-readout" aria-live="polite">
        {current?.description}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title}>
        {ticks.map((t) => (
          <g key={t} className="tempchart-grid">
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {t.toFixed(1).replace('.', ',')}
            </text>
          </g>
        ))}
        {dayTicks.map((d) => (
          <text key={d} className="tempchart-x" x={x(d)} y={H - 6} textAnchor="middle">
            {d}
          </text>
        ))}
        {coverline && (
          <g className="tempchart-coverline">
            <line x1={PAD.left} x2={W - PAD.right} y1={y(coverline.value)} y2={y(coverline.value)} />
            <text x={W - PAD.right - 2} y={y(coverline.value) - 5} textAnchor="end">
              {coverline.label}
            </text>
          </g>
        )}
        {ovulationDay && (
          <g className="tempchart-ovulation">
            <line x1={x(ovulationDay.day)} x2={x(ovulationDay.day)} y1={PAD.top} y2={PAD.top + plotH} />
            <text x={x(ovulationDay.day) + 4} y={PAD.top + 10}>
              {ovulationDay.label}
            </text>
          </g>
        )}
        {line && <path className="tempchart-line" d={line} />}
        {points.map((p, i) => (
          <circle
            key={p.date}
            className={`tempchart-dot${p.disturbed ? ' is-disturbed' : ''}${i === active ? ' is-active' : ''}`}
            cx={x(p.day)}
            cy={y(p.value)}
            r={i === active ? 4.5 : 3}
            tabIndex={0}
            role="button"
            aria-label={p.description}
            onClick={() => setActive(i)}
            onFocus={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
          />
        ))}
      </svg>
    </figure>
  );
}
