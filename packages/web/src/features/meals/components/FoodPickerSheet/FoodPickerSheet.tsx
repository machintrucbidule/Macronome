import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/Modal/Modal';
import { useMeals } from '../../MealsContext';
import { useFoodSearch } from '../../hooks/useFoodLookup';
import type { EditTarget } from '../../hooks/mealActions';
import styles from './food-picker-sheet.module.css';

// Mobile-only food picker (spec §5.3 / overlay taxonomy §0.2). Replaces the inline autocomplete on
// phones: a search field + a tappable result list (foods ∪ recipes via the same `/search/loggable`),
// shown as a bottom sheet (owner refinement 2026-06-11 — same anchor as the other meal sheets). A
// pick routes through `actions.pickFood` (add/replace), "+ Valeurs manuelles" → `actions.openCustom`;
// both close the editing state, unmounting this sheet. Rendered from MealsOverlays only when
// `useIsMobile()` — desktop keeps the inline picker untouched. Search-only by owner decision (no
// "recents": the app has no recently-logged source).
export function FoodPickerSheet({ target }: { target: EditTarget }) {
  const { t } = useTranslation();
  const { actions, day } = useMeals();
  const [query, setQuery] = useState(target.initialQuery ?? '');
  const search = useFoodSearch(query, true);
  const results = search.data?.data ?? [];

  // Outline the line's current food when replacing (parity with the inline picker's `currentId`).
  const currentFoodId = useMemo(() => {
    if (!target.entryId || !day) return null;
    const e = day.meals.flatMap((m) => m.entries).find((x) => x.id === target.entryId);
    return e?.food_id ?? null;
  }, [target.entryId, day]);

  const title = target.entryId ? t('meals.picker.titleReplace') : t('meals.picker.titleAdd');

  const pick = (id: string): void =>
    void actions.pickFood(
      {
        mealId: target.mealId,
        mealIndex: target.mealIndex,
        entryId: target.entryId,
        orderIndex: target.orderIndex ?? null,
      },
      id,
      results.find((r) => r.id === id)?.named_portions,
    );

  return (
    <Modal title={title} onClose={actions.closeEdit}>
      <div className={styles.picker}>
        <input
          className={styles.search}
          autoFocus
          value={query}
          placeholder={t('meals.search.placeholder')}
          aria-label={t('meals.search.placeholder')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.results}>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${styles.row} ${r.id === currentFoodId ? styles.cur : ''}`}
              onClick={() => pick(r.id)}
            >
              <span className={styles.name}>{r.name}</span>
              {r.kind === 'recipe' ? (
                <span className={styles.tag}>{t('meals.tag.recipe')}</span>
              ) : r.named_portions.length ? (
                <span className={styles.tag}>{t('meals.tag.portion')}</span>
              ) : null}
            </button>
          ))}
          {results.length === 0 && <div className={styles.empty}>{t('meals.search.empty')}</div>}
          <button
            type="button"
            className={styles.custom}
            onClick={() =>
              actions.openCustom(target.mealId, target.mealIndex, target.entryId, target.orderIndex)
            }
          >
            {t('meals.search.custom')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
