import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

// Button (design/components/buttons.md): primary / ghost / danger. Minimal subset
// for M1; further variants (secondary, SubmitButton spinner) arrive when needed.
type Variant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  const classes = [styles.btn, styles[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
