import { useEffect, useRef } from 'react';
import styles from './BulkEdit.module.css';

// The selection checkbox of a catalogue list (BE-1, design/components/data-tables.md §Selection
// column). A native input, tinted — no custom control (forms-inputs.md §Checkbox). It carries no
// text of its own, so the label rides on `aria-label`.
//
// `indeterminate` is a DOM property, not an attribute: React cannot set it through JSX, hence the
// ref. It is what makes the header box readable at a glance — some rows ticked is neither "none"
// nor "all".

interface Props {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  /** `card` is the mobile variant: bottom-right of the card and faint until used. */
  variant?: 'cell' | 'card';
}

export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
  variant = 'cell',
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={variant === 'card' ? styles.cardBox : styles.cellBox}
      checked={checked}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.checked)}
      // The row/card behind this box opens the editor on click; ticking must not do that too.
      onClick={(e) => e.stopPropagation()}
    />
  );
}
