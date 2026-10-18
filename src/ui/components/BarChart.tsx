import { useState } from 'react';
import './BarChart.css';

export interface Bar {
  key: string;
  /** Short axis label, e.g. "12.8." */
  label: string;
  value: number;
  /** Readout and accessible name, e.g. "12. Aug.: 29 Tage". */
  description: string;
  /** Drawn hollow (dashed): shown but not counted. */
  muted?: boolean;
}

interface Props {
  title: string;
  bars: readonly Bar[];
  yMax: number;
  tone: 'period' | 'luteal';
  /** Shaded normal range, drawn behind the bars. */
  band?: { from: number; to: number; label: string };
  /** Horizontal reference line. */
  limit?: { value: number; label: string };
}

const W = 340;
const H = 168;
const PAD = { top: 12, right: 8, bottom: 22, left: 26 };
const BAR_MAX = 24;
const GAP = 2;
const RADIUS = 4;

/** Column path: 4px rounded data end, square at the baseline. */
function column(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, h, w / 2);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

function ticks(max: number): number[] {
  const step = max > 30 ? 10 : max > 12 ? 5 : 2;
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
}

/**
 * Single-series column chart in the atlas style: hairline grid, thin columns with a 4px rounded
 * data end, an optional normal-range band and limit line. Tap or hover a column for its value.
 */
export function BarChart({ title, bars, yMax, tone, band, limit }: Props) {
  const [active, setActive] = useState(bars.length - 1);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(bars.length, 1);
  const barW = Math.min(BAR_MAX, slot - GAP);
  const y = (v: number) => PAD.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const current = bars[active];

  return (
    <figure className="barchart">
      <p className="barchart-readout" aria-live="polite">
        {current?.description}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title}>
        {band && (
          <g className="barchart-band">
            <rect x={PAD.left} y={y(band.to)} width={plotW} height={y(band.from) - y(band.to)} />
            <text x={W - PAD.right - 4} y={y(band.to) + 12} textAnchor="end">
              {band.label}
            </text>
          </g>
        )}
        {ticks(yMax).map((t) => (
          <g key={t} className="barchart-grid">
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {limit && (
          <g className="barchart-limit">
            <line x1={PAD.left} x2={W - PAD.right} y1={y(limit.value)} y2={y(limit.value)} />
            <text x={W - PAD.right - 4} y={y(limit.value) - 4} textAnchor="end">
              {limit.label}
            </text>
          </g>
        )}
        {bars.map((b, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const top = y(b.value);
          return (
            <g key={b.key}>
              <path
                className={`barchart-bar tone-${tone}${b.muted ? ' is-muted' : ''}${i === active ? ' is-active' : ''}`}
                d={column(x, top, barW, PAD.top + plotH - top)}
              />
              {(i === 0 || i === bars.length - 1 || i === active) && (
                <text className="barchart-x" x={x + barW / 2} y={H - 6} textAnchor="middle">
                  {b.label}
                </text>
              )}
              <rect
                className="barchart-hit"
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                tabIndex={0}
                role="button"
                aria-label={b.description}
                aria-pressed={i === active}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
              />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
