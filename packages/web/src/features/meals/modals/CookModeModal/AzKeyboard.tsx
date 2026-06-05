import styles from './cook-mode.module.css';

// Virtual A–Z keyboard for cook mode (specifications/screens/meals.md §Cook mode): alphabetical,
// layout identical in every language (so it is not localised). Shown in place of the keypad while
// picking a food by name; feeds the search query in useCookSession.
const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ROWS = [0, 1, 2, 3, 4].map((r) => AZ.slice(r * 6, r * 6 + 6));

interface AzKeyboardProps {
  spaceLabel: string;
  onType: (ch: string) => void;
  onBackspace: () => void;
}

export function AzKeyboard({ spaceLabel, onType, onBackspace }: AzKeyboardProps) {
  return (
    <div className={styles.azkb}>
      {ROWS.map((row, i) => (
        <div key={i} className={styles.krow}>
          {row.map((c) => (
            <button key={c} type="button" onClick={() => onType(c)}>
              {c}
            </button>
          ))}
          {i === ROWS.length - 1 && (
            <>
              <button type="button" className={styles.wide} onClick={() => onType(' ')}>
                {spaceLabel}
              </button>
              <button type="button" onClick={onBackspace}>
                ⌫
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
