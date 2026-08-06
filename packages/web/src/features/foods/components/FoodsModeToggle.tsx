import { useTranslation } from 'react-i18next';
import styles from '../foods.module.css';

// Aliments mode switch (B-292): Mes aliments ↔ Catalogue Ciqual (Anses). On its own band under
// the toolbar — the toolbar is a single flex row already carrying the title, the count, the
// search field, the filters and the add button, and on mobile it is sticky and even tighter.
// The label names the producer, which doubles as an attribution where the data is consulted.
export type FoodsMode = 'library' | 'catalog';

const MODES: FoodsMode[] = ['library', 'catalog'];

export function FoodsModeToggle({
  mode,
  onMode,
}: {
  mode: FoodsMode;
  onMode: (mode: FoodsMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.modeBand}>
      <div className={styles.modeseg} role="group" aria-label={t('foods.mode.label')}>
        {MODES.map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => onMode(m)}>
            {t(`foods.mode.${m}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
