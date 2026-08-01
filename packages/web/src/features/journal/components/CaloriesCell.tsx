import { useEffect, useState } from 'react';
import { tableStyles } from '../../../components/DataTable/SortableTh';
import { r0 } from '../format';
import styles from '../journal.module.css';

// The Journal Calories cell (day-model §3.3). On a day with no real meal detail (editable),
// it is an inline number input: typing a total creates/updates a summary (yellow) day via
// PATCH /days/:date {summary_kcal}. On a detailed day (green) it shows the read-only derived Σ,
// clickable to open that day's Repas. Renders its own <td> (one cell either way).
interface CaloriesCellProps {
  kcal: number;
  editable: boolean;
  placeholder: string;
  onOpen: () => void;
  onSave: (kcal: number) => void;
}

export function CaloriesCell({ kcal, editable, placeholder, onOpen, onSave }: CaloriesCellProps) {
  // Seeded at display precision (B-250): kcal shows as an integer everywhere, editable or
  // not (spec/logic/00-conventions.md §Rounding); the server keeps the exact derived sum.
  const [draft, setDraft] = useState(kcal > 0 ? String(r0(kcal)) : '');

  // Re-seed from the server value (e.g. after a refetch); show blank for a 0/empty day.
  useEffect(() => {
    setDraft(kcal > 0 ? String(r0(kcal)) : '');
  }, [kcal]);

  if (!editable) {
    return (
      <td className={`${tableStyles.num} ${tableStyles.clickable}`} onClick={onOpen}>
        {r0(kcal)}
      </td>
    );
  }

  const commit = (): void => {
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && n !== kcal) onSave(n);
  };

  return (
    <td className={tableStyles.num}>
      <input
        className={styles.kcalInput}
        value={draft}
        inputMode="numeric"
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </td>
  );
}
