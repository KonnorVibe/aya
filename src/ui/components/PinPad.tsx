import { useEffect, useState } from 'react';
import { de } from '../../i18n/de.ts';
import './PinPad.css';

export const PIN_LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

interface Props {
  title: string;
  message?: string;
  disabled?: boolean;
  /** Called with the full PIN; the pad clears itself afterwards. */
  onComplete: (pin: string) => void;
}

/** Numeric keypad with a dot readout. Also accepts the hardware keyboard. */
export function PinPad({ title, message, disabled = false, onComplete }: Props) {
  const [digits, setDigits] = useState('');

  const press = (key: string) => {
    if (disabled) return;
    if (key === 'del') return setDigits((d) => d.slice(0, -1));
    const next = (digits + key).slice(0, PIN_LENGTH);
    if (next.length === PIN_LENGTH) {
      setDigits('');
      onComplete(next);
    } else {
      setDigits(next);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="pinpad">
      <h1 className="pinpad-title">{title}</h1>
      <div className="pinpad-dots" role="status" aria-label={de.lock.entered(digits.length, PIN_LENGTH)}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={i < digits.length ? 'is-filled' : undefined} />
        ))}
      </div>
      <p className="pinpad-message" aria-live="assertive">
        {message}
      </p>
      <div className="pinpad-keys">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={k}
              type="button"
              className={k === 'del' ? 'pinpad-key is-del' : 'pinpad-key'}
              disabled={disabled}
              aria-label={k === 'del' ? de.lock.delete : undefined}
              onClick={() => press(k)}
            >
              {k === 'del' ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 6h10v12H9l-5-6zM12 9.5l5 5M17 9.5l-5 5" />
                </svg>
              ) : (
                k
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
