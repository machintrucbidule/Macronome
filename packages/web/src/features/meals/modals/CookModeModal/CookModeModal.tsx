import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Meal } from '@macronome/shared';
import { useFocusTrap } from '../../../../components/Modal/useFocusTrap';
import { useMeals } from '../../MealsContext';
import { useCookSession } from './useCookSession';
import { useFontAutosize } from './useFontAutosize';
import { CookList } from './CookList';
import { CookPad } from './CookPad';
import styles from './cook-mode.module.css';

// Near-fullscreen, keyboard-free cook mode (specifications/screens/meals.md §Cook mode): adjust the
// meal's real weights/units/foods on a kitchen tablet. Edits live on an in-memory working copy
// (useCookSession); Valider dispatches the diffed entry patches, Annuler discards. It renders the
// server's lines and reuses the meal-screen food search + unit menu; it never computes nutrition.
interface CookModeModalProps {
  meal: Meal;
}

export function CookModeModal({ meal }: CookModeModalProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const s = useCookSession(meal);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);
  const fontSize = useFontAutosize(listRef, Math.max(s.lines.length, 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') actions.closeCook();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [actions]);

  const validate = (): void => {
    void actions.applyCookEdits(meal.id, s.diff());
  };

  const selected = s.lines.find((l) => l.id === s.selectedId) ?? null;
  const qtyUnit = selected ? (selected.unit === 'portion' ? 'portion' : selected.unit) : '';
  const hint =
    s.mode === 'qty' && selected
      ? t('meals.cook.hintQty', { qty: s.displayQty(selected), unit: qtyUnit })
      : t('meals.cook.hintIdle');

  return (
    <div
      className={styles.scrim}
      onClick={(e) => {
        if (e.target === e.currentTarget) actions.closeCook();
      }}
    >
      <div ref={panelRef} className={styles.modal} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className={styles.head}>
          <div className={styles.title}>
            {meal.slot_name} <small>{t('meals.cook.subtitle')}</small>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label={t('meals.cook.close')}
            onClick={actions.closeCook}
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <CookList session={s} listRef={listRef} fontSize={fontSize} />

          <CookPad
            mode={s.mode}
            hint={hint}
            results={s.results}
            onKey={s.typeDigit}
            onType={s.typeChar}
            onBackspace={s.backspace}
            onPick={s.pickFood}
          />
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={actions.closeCook}>
            {t('meals.cook.cancel')}
          </button>
          <button type="button" className={styles.ok} onClick={validate}>
            {t('meals.cook.validate')}
          </button>
        </div>
      </div>
    </div>
  );
}
