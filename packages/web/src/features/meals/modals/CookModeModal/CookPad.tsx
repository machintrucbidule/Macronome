import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NumPad } from './NumPad';
import { AzKeyboard } from './AzKeyboard';
import type { CookMode } from './useCookSession';
import styles from './cook-mode.module.css';

// The cook-mode right pane: the numeric keypad (qty editing), or — while picking a food by name —
// the search results list above the virtual A–Z keyboard. Pure presentational switch over the
// session mode; all state lives in useCookSession.
interface CookPadProps {
  mode: CookMode;
  hint: ReactNode;
  results: { id: string; name: string }[];
  onKey: (ch: string) => void;
  onType: (ch: string) => void;
  onBackspace: () => void;
  onPick: (foodId: string) => void;
}

export function CookPad({ mode, hint, results, onKey, onType, onBackspace, onPick }: CookPadProps) {
  const { t } = useTranslation();

  if (mode === 'name') {
    return (
      <div className={styles.pad}>
        <div className={styles.hint}>{t('meals.cook.hintName')}</div>
        <div className={styles.results}>
          {results.length === 0 ? (
            <div className={styles.noFoods}>{t('meals.cook.noFoods')}</div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                className={styles.result}
                onClick={() => onPick(r.id)}
              >
                {r.name}
              </button>
            ))
          )}
        </div>
        <AzKeyboard spaceLabel={t('meals.cook.space')} onType={onType} onBackspace={onBackspace} />
      </div>
    );
  }

  return (
    <div className={styles.pad}>
      <NumPad disabled={mode !== 'qty'} hint={hint} onKey={onKey} onBackspace={onBackspace} />
    </div>
  );
}
