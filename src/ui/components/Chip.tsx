import type { ButtonHTMLAttributes } from 'react';
import './Chip.css';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  selected: boolean;
  onToggle: () => void;
  tone?: 'period' | 'fertile' | 'luteal' | 'ink';
}

/** Toggle chip for the day log; selection is shown by fill and a check mark, not colour alone. */
export function Chip({ selected, onToggle, tone = 'ink', children, ...rest }: Props) {
  return (
    <button type="button" className={`chip chip-${tone}`} aria-pressed={selected} onClick={onToggle} {...rest}>
      <svg className="chip-check" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 6.5 5 9l4.5-6" />
      </svg>
      {children}
    </button>
  );
}
