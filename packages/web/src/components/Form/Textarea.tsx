import type { ReactNode, TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.css';

// Labelled multi-line field (design/components/forms-inputs.md §Textarea). Mirrors TextInput:
// `label` wraps the control, `invalid` toggles the aria-invalid styling, `className` lands on
// the <textarea> so a host can raise its min-height.
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  invalid?: boolean;
  /** Technical content (Assistant IA prompt / avoidances) → --font-num at --fs-12. */
  mono?: boolean;
  /** Render the "n / maxLength" counter under the field (AI note fields). */
  counter?: boolean;
  /** Extra class on the wrapper — e.g. to keep a host's own top margin. */
  wrapperClassName?: string | undefined;
}

export function Textarea({
  label,
  invalid,
  mono,
  counter,
  wrapperClassName,
  className,
  ...rest
}: TextareaProps) {
  const area = (
    <textarea
      className={[styles.area, mono ? styles.mono : '', className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
  const count =
    counter && rest.maxLength != null ? (
      <div className={styles.count}>{`${String(rest.value ?? '').length} / ${rest.maxLength}`}</div>
    ) : null;
  const wrapCls = [styles.field, wrapperClassName].filter(Boolean).join(' ');
  if (!label) {
    return count ? (
      <div className={wrapCls}>
        {area}
        {count}
      </div>
    ) : (
      area
    );
  }
  return (
    <label className={wrapCls}>
      <span className={styles.label}>{label}</span>
      {area}
      {count}
    </label>
  );
}
