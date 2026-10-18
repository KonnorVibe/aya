import { de } from '../../i18n/de.ts';
import './Stepper.css';

interface Props {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  fallback: number;
  format: (n: number) => string;
  unknownLabel?: string;
  onChange: (value: number | undefined) => void;
}

/** − value + control; `undefined` means "not known". */
export function Stepper({ label, value, min, max, fallback, format, unknownLabel, onChange }: Props) {
  const current = value ?? fallback;
  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className="stepper-label">{label}</span>
      <div className="stepper-control">
        <button
          type="button"
          aria-label={de.onboarding.period.decrease(label)}
          disabled={value !== undefined && value <= min}
          onClick={() => onChange(Math.max(min, value === undefined ? fallback : current - 1))}
        >
          −
        </button>
        <output aria-live="polite">{value === undefined ? (unknownLabel ?? '–') : format(value)}</output>
        <button
          type="button"
          aria-label={de.onboarding.period.increase(label)}
          disabled={value !== undefined && value >= max}
          onClick={() => onChange(Math.min(max, value === undefined ? fallback : current + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}
