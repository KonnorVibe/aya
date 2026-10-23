import type { Prediction } from '../../engine/prediction.ts';
import './ConfidenceDonut.css';

/** From this many complete cycles on, the prediction rests on personal data alone. */
export const FULL_CYCLES = 6;

/**
 * How much of the prediction rests on your own data, in percent: complete cycles counted so far
 * out of six. Up to the sixth, aya still mixes in an average (see Methodik), from then on not.
 */
export function confidencePercent(prediction: Pick<Prediction, 'usedCycles'>): number {
  return Math.round((Math.min(prediction.usedCycles, FULL_CYCLES) / FULL_CYCLES) * 100);
}

const R = 22;
const CIRC = 2 * Math.PI * R;

/** A small donut that fills with the percent; the number sits in the middle. */
export function ConfidenceDonut({ percent, label }: { percent: number; label: string }) {
  return (
    <svg className="donut" viewBox="0 0 56 56" role="img" aria-label={label}>
      <circle className="donut-track" cx="28" cy="28" r={R} />
      <circle
        className="donut-fill"
        cx="28"
        cy="28"
        r={R}
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - percent / 100)}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle">
        {percent}
        <tspan className="donut-unit">%</tspan>
      </text>
    </svg>
  );
}
