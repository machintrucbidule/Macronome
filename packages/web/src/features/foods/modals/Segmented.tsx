import styles from '../foods.module.css';

// A small two-option segmented control (the `aria-pressed` pattern used by the food
// modal's Visibility and "Dispo IA" fields). Presentational over a value + setter.
interface SegmentedOption<T> {
  value: T;
  label: string;
}
interface SegmentedProps<T extends string | boolean> {
  label: string;
  value: T;
  options: [SegmentedOption<T>, SegmentedOption<T>];
  onChange: (value: T) => void;
}

export function Segmented<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div>
      <div className={styles.segLabel}>{label}</div>
      <div className={styles.visseg}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
