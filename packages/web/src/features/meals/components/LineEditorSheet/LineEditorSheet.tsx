import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MealEntry } from '@macronome/shared';
import { Modal } from '../../../../components/Modal/Modal';
import { evalQuantity } from '../../../../lib/format/parse';
import { useMeals } from '../../MealsContext';
import { useFood } from '../../hooks/useFoodLookup';
import type { LineSheetTarget } from '../../hooks/mealActions';
import { UnitMenu } from '../FoodLine/UnitMenu';
import styles from './line-editor-sheet.module.css';

// Mobile-only bottom-sheet line editor (spec §5.3 / overlay taxonomy §0.2). Opened by tapping the
// body of a two-row food line on phones; gathers the actions that left the line itself on mobile
// (change food, quantity + unit, pin, delete). Reuses the existing meal actions verbatim. Rendered
// from MealsOverlays only when `useIsMobile()` — desktop edits inline, never mounting this sheet.

// Quantity + unit editor (referenced lines). Commits the served quantity via the same setQty
// action the desktop QtyCell uses (arithmetic expressions accepted, B-108); the unit chip opens the
// shared UnitMenu.
function QtyRow({ entry, target }: { entry: MealEntry; target: LineSheetTarget }) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const [value, setValue] = useState(String(entry.served_quantity));
  const [menuOpen, setMenuOpen] = useState(false);

  const commit = (): void => {
    const qty = evalQuantity(value);
    if (qty === null || qty < 0) return setValue(String(entry.served_quantity));
    setValue(String(qty));
    if (qty !== entry.served_quantity)
      void actions.setQty(
        target.mealId,
        target.mealIndex,
        entry,
        qty,
        entry.unit,
        entry.portion_id,
      );
  };

  return (
    <div className={styles.qtyRow}>
      <span className={styles.label}>{t('meals.lineSheet.quantity')}</span>
      <input
        className={`${styles.qtyInput} num`}
        value={value}
        inputMode="decimal"
        aria-label={t('meals.lineSheet.quantity')}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      <div className={styles.unitWrap}>
        <button type="button" className={styles.unitChip} onClick={() => setMenuOpen((o) => !o)}>
          {entry.unit === 'portion' ? t('meals.unit.portionAbbr') : entry.unit}
        </button>
        {menuOpen && (
          <UnitMenu
            foodId={entry.food_id}
            currentUnit={entry.unit}
            currentPortionId={entry.portion_id}
            onSelect={(unit, portionId) => {
              setMenuOpen(false);
              void actions.setUnit(target.mealId, target.mealIndex, entry, unit, portionId);
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// Display name for the edited line (custom name, or the looked-up food name with a loading dash).
function lineName(
  isCustom: boolean,
  entry: MealEntry | null,
  foodName: string | undefined,
): string {
  if (isCustom) return entry?.custom_name ?? '';
  return foodName ?? '…';
}

// Quantity + pin controls — only for referenced lines (custom lines edit via the custom modal).
// Split out so the sheet body stays simple (the `entry && !isCustom` guard appears once).
function ReferencedControls({ entry, target }: { entry: MealEntry; target: LineSheetTarget }) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  return (
    <>
      <QtyRow entry={entry} target={target} />
      <button
        type="button"
        className={styles.action}
        onClick={() => void actions.togglePin(target.mealId, target.entryId, entry.is_pinned)}
      >
        {entry.is_pinned ? t('meals.lineSheet.unpin') : t('meals.lineSheet.pin')}
      </button>
    </>
  );
}

export function LineEditorSheet({ target }: { target: LineSheetTarget }) {
  const { t } = useTranslation();
  const { actions, day } = useMeals();
  const entry = day?.meals.flatMap((m) => m.entries).find((e) => e.id === target.entryId) ?? null;
  const isCustom = entry?.kind === 'custom';
  const food = useFood(entry && !isCustom ? entry.food_id : null);
  const name = lineName(isCustom, entry, food.data?.data.name);
  const close = actions.closeLineSheet;

  // "Change food" / "Edit custom values" hand off to the picker / custom modal — close this sheet
  // first so the two overlays never stack.
  const handoff = (open: () => void) => () => {
    close();
    open();
  };
  const onFood = handoff(() =>
    isCustom
      ? actions.openCustom(target.mealId, target.mealIndex, target.entryId)
      : actions.startEdit(target.mealId, target.mealIndex, target.entryId),
  );

  return (
    <Modal title={t('meals.lineSheet.title')} mobile="sheet" size="confirm" onClose={close}>
      <div className={styles.sheet}>
        <button type="button" className={styles.foodRow} onClick={onFood}>
          <span className={styles.foodName}>{name}</span>
          <span className={styles.change}>
            {isCustom ? t('meals.lineSheet.editCustom') : t('meals.lineSheet.changeFood')}
          </span>
        </button>
        {entry && !isCustom && <ReferencedControls entry={entry} target={target} />}
        <button
          type="button"
          className={`${styles.action} ${styles.danger}`}
          onClick={handoff(() => void actions.deleteEntry(target.mealId, target.entryId))}
        >
          {t('meals.lineSheet.delete')}
        </button>
      </div>
    </Modal>
  );
}
