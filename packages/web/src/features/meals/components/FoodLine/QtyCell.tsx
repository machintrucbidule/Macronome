import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { EntryUnit, MealEntry } from '@macronome/shared';
import { useMeals } from '../../MealsContext';
import { useFood } from '../../hooks/useFoodLookup';
import { caretAtEdge, focusSiblingQty } from '../../hooks/useMealKeyboardNav';
import { UnitMenu } from './UnitMenu';
import styles from './food-line.module.css';

// Quantity input + unit chip for a referenced line. The input is locally controlled and
// commits on Enter/blur (the server then recomputes the snapshot/totals); the unit chip opens
// the UnitMenu. Arrows at the field edge and Tab walk between quantity cells.
interface QtyCellProps {
  mealId: string;
  entry: MealEntry;
}

// Unit chip + menu. For a portion it shows "nb" (display-only abbreviation, not a real
// unit — B-031) with the full "label (grams g)" in its tooltip (B-032) and the unit menu.
function UnitChip({ mealId, entry }: QtyCellProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const [menuOpen, setMenuOpen] = useState(false);
  const isPortion = entry.unit === 'portion';
  const portionFood = useFood(isPortion ? entry.food_id : null);
  const portion = portionFood.data?.data.named_portions.find((p) => p.id === entry.portion_id);
  const chipLabel = isPortion ? t('meals.unit.portionAbbr') : entry.unit;
  const chipTitle = isPortion
    ? portion
      ? `${portion.label} (${portion.grams} g)`
      : t('meals.unit.portionAbbr')
    : entry.unit;

  return (
    <>
      <span
        className={styles.unit}
        title={chipTitle}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
      >
        {chipLabel}
      </span>
      {menuOpen && (
        <UnitMenu
          foodId={entry.food_id}
          currentUnit={entry.unit}
          currentPortionId={entry.portion_id}
          onSelect={(unit: EntryUnit, portionId) => {
            setMenuOpen(false);
            void actions.setUnit(mealId, entry.id, unit, portionId);
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}

export function QtyCell({ mealId, entry }: QtyCellProps) {
  const { actions, pendingFocus } = useMeals();
  const [value, setValue] = useState(String(entry.served_quantity));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(String(entry.served_quantity)), [entry.served_quantity]);
  useEffect(() => {
    if (pendingFocus === entry.id) {
      inputRef.current?.focus();
      inputRef.current?.select();
      actions.clearFocus();
    }
  }, [pendingFocus, entry.id, actions]);

  const commit = (): void => {
    const n = Number(value.replace(',', '.'));
    const qty = Number.isFinite(n) ? n : 0;
    if (qty !== entry.served_quantity)
      void actions.setQty(mealId, entry.id, qty, entry.unit, entry.portion_id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      focusSiblingQty(e.currentTarget, 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setValue(String(entry.served_quantity));
      e.currentTarget.blur();
    } else if (e.key === 'Tab') {
      commit();
    } else if (e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && caretAtEdge(e.currentTarget, -1))) {
      e.preventDefault();
      commit();
      focusSiblingQty(e.currentTarget, -1);
    } else if (
      e.key === 'ArrowDown' ||
      (e.key === 'ArrowRight' && caretAtEdge(e.currentTarget, 1))
    ) {
      e.preventDefault();
      commit();
      focusSiblingQty(e.currentTarget, 1);
    }
  };

  return (
    <span className={styles.qtyCell}>
      <input
        ref={inputRef}
        data-meal-qty
        className={`${styles.qty} num`}
        value={value}
        inputMode="decimal"
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      />
      <UnitChip mealId={mealId} entry={entry} />
    </span>
  );
}
