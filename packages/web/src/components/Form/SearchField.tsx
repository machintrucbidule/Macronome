import { forwardRef, type InputHTMLAttributes } from 'react';
import styles from './Form.module.css';

// Search field with an inset magnifier (design/components/forms-inputs.md). The
// placeholder notes accent-insensitivity. Controlled value comes from the caller.
// Forwards its ref to the inner <input> so a search overlay can hand it to the modal
// focus trap as the initial-focus target (B-206).
type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField(props, ref) {
    return (
      <span className={styles.search}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        {/* B-270: phone-keyboard defaults for a search box — no auto-capitalised first letter,
            no spellchecker underline on food names, and a "Rechercher" return key. Declared
            before the spread so a call site can still override any of them. */}
        <input
          ref={ref}
          type="search"
          className={styles.input}
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          {...props}
        />
      </span>
    );
  },
);
