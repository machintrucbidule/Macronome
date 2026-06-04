import { useEffect, useState } from 'react';
import styles from '../journal.module.css';

// Inline-editable day comment (history.md §Interactions: "saved on blur/change"). Keeps a
// local draft seeded from the server value and emits a save only when the value actually
// changed on blur — one PATCH per edited field, never per keystroke.
interface CommentCellProps {
  value: string | null;
  placeholder: string;
  onSave: (value: string | null) => void;
}

export function CommentCell({ value, placeholder, onSave }: CommentCellProps) {
  const [draft, setDraft] = useState(value ?? '');

  // Re-seed when the server value changes (e.g. after a refetch) and we're not mid-edit.
  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = (): void => {
    const next = draft.trim();
    const current = value ?? '';
    if (next === current) return;
    onSave(next === '' ? null : next);
  };

  return (
    <input
      className={styles.comment}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
