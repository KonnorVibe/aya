import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet';
}

export function Button({ variant = 'primary', className, type = 'button', ...rest }: Props) {
  return <button type={type} className={`btn btn-${variant}${className ? ` ${className}` : ''}`} {...rest} />;
}
