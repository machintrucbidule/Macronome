import { type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Form.module.css';

// Numeric input with an optional unit suffix and a custom stacked ▲▼ stepper inside the
// field box, at the far right, after the unit (design/components/forms-inputs.md, B-006).
// The native browser spinner is hidden (CSS) — it can't render value·unit·spinner — so our
// buttons apply the step (honouring step/min/max) and notify the controlled parent.
interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  suffix?: string;
  invalid?: boolean;
  /** Extra class on the field wrapper — e.g. to size a compact field (Cibles). */
  wrapperClassName?: string | undefined;
}

/** Step `value` by `dir × step`, clamped to min/max, trimmed to the step's decimals. */
function nextValue(
  value: NumberInputProps['value'],
  dir: 1 | -1,
  step: NumberInputProps['step'],
  min: NumberInputProps['min'],
  max: NumberInputProps['max'],
): string {
  const stepN = Number(step) || 1;
  const cur = Number(value);
  let next = (Number.isFinite(cur) ? cur : 0) + dir * stepN;
  if (min != null && min !== '' && next < Number(min)) next = Number(min);
  if (max != null && max !== '' && next > Number(max)) next = Number(max);
  const decimals = (String(stepN).split('.')[1] ?? '').length;
  return decimals ? next.toFixed(decimals) : String(next);
}

export function NumberInput({
  label,
  suffix,
  invalid,
  className,
  wrapperClassName,
  value,
  onChange,
  step,
  min,
  max,
  ...rest
}: NumberInputProps) {
  const fieldCls = [styles.input, styles.num, className].filter(Boolean).join(' ');
  const wrapCls = [styles.control, suffix ? styles.withSuffix : '', wrapperClassName]
    .filter(Boolean)
    .join(' ');

  const stepBy = (dir: 1 | -1): void => {
    if (!onChange) return;
    const nextStr = nextValue(value, dir, step, min, max);
    onChange({ target: { value: nextStr } } as unknown as ChangeEvent<HTMLInputElement>);
  };

  const control = (
    <span className={wrapCls}>
      <input
        type="number"
        className={fieldCls}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={onChange}
        step={step}
        min={min}
        max={max}
        {...rest}
      />
      {suffix && <span className={styles.suffix}>{suffix}</span>}
      <span className={styles.stepper} aria-hidden="true">
        <button type="button" tabIndex={-1} onClick={() => stepBy(1)}>
          ▲
        </button>
        <button type="button" tabIndex={-1} onClick={() => stepBy(-1)}>
          ▼
        </button>
      </span>
    </span>
  );
  if (!label) return control;
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {control}
    </label>
  );
}
