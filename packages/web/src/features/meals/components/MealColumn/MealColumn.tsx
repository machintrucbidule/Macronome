import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Meal, MealEntry } from '@macronome/shared';
import { useIsMobile } from '../../../../lib/useIsMobile';
import { useMeals } from '../../MealsContext';
import { DEFAULT_LINES_DESKTOP, DEFAULT_LINES_MOBILE, buildLineRows } from '../../logic/lineRows';
import { eligibleIds } from '../../logic/selectionSum';
import { useLineDnd } from '../../hooks/useLineDnd';
import { useTouchReorder } from '../../hooks/useTouchReorder';
import { useMealPhotoEntry } from '../../hooks/useMealPhotoEntry';
import { useMealPhotoDrop } from '../../hooks/useMealPhotoDrop';
import { MealLines } from './MealLines';
import { MealHeader } from './MealHeader';
import { MealPhotoButton } from './MealPhotoButton';
import { MealPhotoFeedback } from './MealPhotoFeedback';
import { MealFooter } from './MealFooter';
import { MealColumnConfirms } from './MealColumnConfirms';
import { canClearMealLines, canZeroMealLines } from '../../logic/mealBulk';
import styles from './meal-column.module.css';

// One meal as a column: header + sub-header + the lines + footer totals. Each entry sits at
// its order_index row; the remaining rows are clickable "+ aliment" empties (B-028). The grip
// drag-reorders lines (B-029). Domain values come from the server (the web never computes).

// Is this row the one being edited? Pure: the inline-search target is (mealIndex, entryId) for a
// filled line, or (mealIndex, orderIndex) for an empty row being added into.
type EditTarget = ReturnType<typeof useMeals>['editing'];
function editingPredicate(editing: EditTarget, mealIndex: number) {
  return (row: number, entry: MealEntry | null): boolean => {
    if (!editing || editing.mealIndex !== mealIndex) return false;
    return entry
      ? editing.entryId === entry.id
      : editing.entryId === null && editing.orderIndex === row;
  };
}

// Swap two meals' order_index (the header's move left/right arrows).
function swapMeals(mutations: ReturnType<typeof useMeals>['mutations'], a: Meal, b: Meal): void {
  void mutations.patchMeal.mutateAsync({ mealId: a.id, body: { order_index: b.order_index } });
  void mutations.patchMeal.mutateAsync({ mealId: b.id, body: { order_index: a.order_index } });
}

/** Move left/right: swap with the neighbour on that side. A missing neighbour disables the menu
 *  entry, so the guard is only belt-and-braces. Module-level to keep MealColumn under its cap. */
function moveMeal(
  mutations: ReturnType<typeof useMeals>['mutations'],
  meals: Meal[],
  index: number,
  delta: -1 | 1,
): void {
  const [meal, neighbour] = [meals[index], meals[index + delta]];
  if (meal && neighbour) swapMeals(mutations, meal, neighbour);
}

/** Rename the meal through the browser prompt (this day's slot only, never the template). */
function promptRename(
  t: ReturnType<typeof useTranslation>['t'],
  meal: Meal,
  rename: ReturnType<typeof useMeals>['actions']['renameMeal'],
): void {
  const next = window.prompt(t('meals.meal.renamePrompt'), meal.slot_name);
  if (next) void rename(meal.id, next);
}

interface MealColumnProps {
  meal: Meal;
  index: number;
  meals: Meal[];
  width: number;
  // Mobile meal-tab layer (S4): ≤560px CSS shows only the active column (every column stays
  // mounted). The flag is surfaced as a `data-meal-col` attribute the scroller's mobile rule
  // targets; it has no effect on desktop (no ≥561px rule reads it).
  active?: boolean;
  // Effective displayed-line floor for this viewport (B-203), resolved from the user setting by
  // MealScroller. Optional so direct renders (tests) fall back to the viewport default.
  minLines?: number;
}

export function MealColumn(props: MealColumnProps) {
  const { meal, index, meals, width, active = false, minLines } = props;
  const { t } = useTranslation();
  const { editing, mutations, actions, lineDragRef } = useMeals();
  const [confirming, setConfirming] = useState(false);
  // Copier le repas de la veille (CP-2/B-248): confirm ONLY when there is content to lose;
  // an empty meal — the common case — copies straight away.
  const [copying, setCopying] = useState(false);
  const copyMeal = (): void => void actions.copyMealYesterday(meal.id, meal.order_index);
  // "Content to lose" is a served line — a qty-0 garde-manger placeholder is not, mirroring the
  // server's own emptiness rule, so a freshly pre-filled meal still copies in one click.
  const hasContent = meal.entries.some((e) => e.served_quantity > 0);
  const isMobile = useIsMobile();
  // Configurable per-meal line floor (B-203); fall back to the viewport default in direct renders.
  const floor = minLines ?? (isMobile ? DEFAULT_LINES_MOBILE : DEFAULT_LINES_DESKTOP);
  const rows = buildLineRows(meal.entries, floor);
  const byRow = new Map<number, MealEntry>(
    rows.flatMap((r) => (r.entry ? ([[r.row, r.entry]] as const) : [])),
  );
  const dnd = useLineDnd(
    meal.id,
    byRow,
    (id, order) => void actions.reorderEntries(id, order),
    lineDragRef,
    (entryId, src, tgt, row) => void actions.moveEntry(src, entryId, tgt, row),
  );
  // Mobile long-press touch reorder (S9) runs alongside the desktop native DnD; both commit through
  // the same reorder action. Inert on desktop (mouse pointers are ignored + handlers unattached).
  const touch = useTouchReorder(isMobile, byRow, (o) => void actions.reorderEntries(meal.id, o));
  // Mobile one-tap photo → AI → custom line (QP-1/B-158); wiring + state live in the hook.
  const photo = useMealPhotoEntry(meal);
  // B-271: on desktop the column itself takes a dropped/pasted image, feeding the same analysis
  // as the phone's 📷 button. Gated on !isMobile like the native line drag (FoodLine).
  const drop = useMealPhotoDrop(photo, !isMobile && photo.configured);

  const isEditing = editingPredicate(editing, meal.order_index);

  return (
    <div
      ref={drop.ref}
      className={`${styles.col} ${drop.dragOver ? styles.photoDropOver : ''}`}
      style={{ width, flexBasis: width }}
      {...drop.dropProps}
      data-meal-col={active ? 'active' : 'idle'}
      // Context-menu meal identity (B-195): lets the delegated resolver map a row to its meal.
      data-ctx-meal={meal.id}
      data-ctx-meal-index={meal.order_index}
    >
      <MealHeader
        name={meal.slot_name}
        canMoveLeft={index > 0}
        canMoveRight={index < meals.length - 1}
        canClearLines={canClearMealLines(meal)}
        canZeroLines={canZeroMealLines(meal)}
        onCook={() => actions.openCook(meal.id)}
        onCopyYesterday={() => (hasContent ? setCopying(true) : copyMeal())}
        // MC-1/B-296: no confirmation, deliberately — the toast's Annuler is the safety net.
        onClearLines={() => void actions.clearMealLines(meal.id, meal.order_index)}
        onZeroLines={() => void actions.zeroMealLines(meal.id, meal.order_index)}
        onRename={() => promptRename(t, meal, actions.renameMeal)}
        onMoveLeft={() => moveMeal(mutations, meals, index, -1)}
        onMoveRight={() => moveMeal(mutations, meals, index, 1)}
        onDelete={() => setConfirming(true)}
        extra={photo.ready ? <MealPhotoButton busy={photo.busy} onClick={photo.trigger} /> : null}
      />
      <MealPhotoFeedback photo={photo} />
      <MealLines
        mealId={meal.id}
        mealIndex={meal.order_index}
        rows={rows}
        isEditing={isEditing}
        dnd={dnd}
        touch={touch}
      />
      <MealFooter mealId={meal.id} totals={meal.totals} entryIds={eligibleIds(meal)} />
      <MealColumnConfirms
        name={meal.slot_name}
        copying={copying}
        deleting={confirming}
        onCancelCopy={() => setCopying(false)}
        onConfirmCopy={() => {
          setCopying(false);
          copyMeal();
        }}
        onCancelDelete={() => setConfirming(false)}
        onConfirmDelete={() => {
          setConfirming(false);
          void actions.deleteMeal(meal.id);
        }}
      />
    </div>
  );
}
