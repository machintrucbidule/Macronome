import type { DragEvent, MouseEvent } from 'react';
import type { MealEntry } from '@macronome/shared';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../lib/useIsMobile';
import { useMeals } from '../../MealsContext';
import { useFood } from '../../hooks/useFoodLookup';
import type { LineDnd } from '../../hooks/useLineDnd';
import type { TouchReorder } from '../../hooks/useTouchReorder';
import { r0 } from '../../format';
import { isSelectableEntry } from '../../logic/selectionSum';
import type { MealSelection } from '../../hooks/useMealSelection';
import { QtyCell } from './QtyCell';
import { PinCell } from './PinCell';
import { InlineFoodSearch } from '../InlineFoodSearch/InlineFoodSearch';
import styles from './food-line.module.css';

// One log line: empty (click to add), referenced (name from the foods API + editable qty), or
// custom (manual values). Each line sits at its `row` (= order_index); the grip drag-reorders
// (B-029) and any line is a drop target. Macros shown are the server's consumed values; the
// web only renders them. The body is split per state to keep each unit simple.
interface FoodLineProps {
  mealId: string;
  mealIndex: number;
  row: number;
  entry: MealEntry | null;
  editing: boolean;
  dnd: LineDnd;
  touch: TouchReorder;
}

/** Props every line passes to make itself a drop target for the drag-reorder. */
const dropProps = (row: number, dnd: LineDnd) => ({
  onDragOver: (e: DragEvent) => e.preventDefault(),
  onDrop: () => dnd.onDrop(row),
});

/** Build an entry row's class list (kept out of the component to cap its complexity). `.selectable`
 *  (the desktop selection-mode cursor cue) is derived here so EntryRow stays within the caps. */
function entryRowClass(flags: {
  isZero: boolean;
  isUsed: boolean;
  isDragging: boolean;
  isGrabbed: boolean;
  isSelected: boolean;
  isMobile: boolean;
  mode: boolean;
  selectable: boolean;
}): string {
  const showSelectableCue = !flags.isMobile && flags.mode && flags.selectable;
  return [
    styles.line,
    flags.isZero && styles.zero,
    flags.isUsed && styles.used,
    flags.isDragging && styles.dragging,
    flags.isGrabbed && styles.grabbed,
    flags.isSelected && styles.selected,
    showSelectableCue && styles.selectable,
  ]
    .filter(Boolean)
    .join(' ');
}

// The amber left-border (liseré) marks a *used* line: one carrying an entered quantity > 0,
// regardless of pin state or kind (B-224). Keys on the entered qty, NOT the leftover-adjusted
// `consumed` (B-047) — a line fully allocated to a leftover container still counts as used.
function isUsedEntry(entry: MealEntry, isCustom: boolean): boolean {
  return isCustom ? (entry.served_grams ?? 0) > 0 : entry.served_quantity > 0;
}

// Desktop selection-sum row click (B-207), kept at module scope so EntryRow stays within the
// complexity/line caps. Ctrl/⌘-click enters the mode + selects; a plain click toggles only while
// selection mode is on; ineligible lines never toggle.
function rowSelectHandler(
  entry: MealEntry,
  selection: MealSelection,
  selectable: boolean,
): (e: MouseEvent) => void {
  return (e) => {
    if (!selectable) return;
    if (e.ctrlKey || e.metaKey) selection.selectFromRow(entry.id, true);
    else if (selection.mode) selection.toggle(entry.id);
  };
}

function EmptyLine({
  row,
  dnd,
  onAdd,
  label,
}: {
  row: number;
  dnd: LineDnd;
  onAdd: (initialQuery?: string) => void;
  label: string;
}) {
  // The "+ Aliment" placeholder is a keyboard tab stop too (meals.md §117, B-105): Tab can land
  // on it and Enter/typing opens the picker to add a food here — even when every line below is
  // empty, so the keyboard flow never dead-ends (Excel parity).
  return (
    <div
      className={`${styles.line} ${styles.empty}`}
      onClick={() => onAdd()}
      {...dropProps(row, dnd)}
      // Context-menu row id (B-195) — distinct from data-line-row so the mobile
      // long-press hit-test keeps targeting entry rows only.
      data-ctx-row={row}
    >
      <span className={styles.grip} />
      <NameCell name={label} isCustom={false} onOpen={onAdd} />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

// The food-name cell: a keyboard tab stop in the name↔qty serpentine (meals.md §113, B-105).
// Enter/Space opens its editor; typing a character opens it already searching that character
// (type-to-search), like the click. Custom lines show the manual pen.
function NameCell({
  name,
  isCustom,
  onOpen,
}: {
  name: string;
  isCustom: boolean;
  onOpen: (initialQuery?: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={styles.nm}
      title={name}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          onOpen(e.key); // type-to-search: seed the picker with this character
        }
      }}
    >
      {name}
      {isCustom && (
        <span className={styles.pen} title={t('meals.line.manual')}>
          ✎
        </span>
      )}
    </div>
  );
}

// The four value cells (kcal/L/G/P) in one wrapper so the mobile two-row layout (S4) can lay them
// out as a single macro cluster (food-line.module.css .macros). `.macros { display: contents }`
// keeps them as direct grid items on desktop → the 9-column grid is byte-identical ≥561px.
function MacroCells({ c }: { c: MealEntry['consumed'] }) {
  return (
    <span className={styles.macros}>
      <span className={`${styles.v} num`} style={{ fontWeight: 700 }}>
        {r0(c.kcal)}
      </span>
      <span className={`${styles.v} num`}>{r0(c.fat)}</span>
      <span className={`${styles.v} num`}>{r0(c.carb)}</span>
      <span className={`${styles.v} num`}>{r0(c.protein)}</span>
    </span>
  );
}

function EntryRow({
  mealId,
  mealIndex,
  row,
  entry,
  dnd,
  touch,
  isMobile,
}: {
  mealId: string;
  mealIndex: number;
  row: number;
  entry: MealEntry;
  dnd: LineDnd;
  touch: TouchReorder;
  isMobile: boolean;
}) {
  const { t } = useTranslation();
  const { actions, selection } = useMeals();
  const isCustom = entry.kind === 'custom';
  const food = useFood(isCustom ? null : entry.food_id);
  const name = isCustom ? (entry.custom_name ?? '') : (food.data?.data.name ?? '…');
  // Muting (grey-out) is pin-conditional (B-107 refined by B-198): only a garde-manger line at
  // qty 0 is greyed as an "unused pantry food"; a normal qty-0 line (e.g. a re-added duplicate)
  // is not muted.
  const isZero = !isCustom && entry.served_quantity === 0 && entry.is_pinned;
  const c = entry.consumed;
  const showPin = !isCustom; // pin only on referenced lines: pantry is food-based (see PinCell)
  const openEdit = (initialQuery?: string): void =>
    isCustom
      ? actions.openCustom(mealId, mealIndex, entry.id)
      : actions.startEdit(mealId, mealIndex, entry.id, undefined, initialQuery);

  // Mobile: a tap on the line body (anywhere the name/qty cells don't intercept) opens the
  // bottom-sheet line editor (spec §5.3). Works for garde-manger scaffold pre-fill lines too
  // (empty id, pinned, qty 0): the sheet resolves them by `row`.
  const openSheet = (): void => actions.openLineSheet(mealId, mealIndex, entry.id, row);
  const selectable = isSelectableEntry(entry); // desktop selection-sum eligibility (B-207)

  return (
    <div
      className={entryRowClass({
        isZero,
        isUsed: isUsedEntry(entry, isCustom), // amber liseré on used (qty>0) lines (B-224)
        isDragging: dnd.dragId === entry.id,
        isGrabbed: touch.grabbedId === entry.id,
        isSelected: selection.isSelected(entry.id),
        isMobile,
        mode: selection.mode,
        selectable,
      })}
      {...dropProps(row, dnd)}
      onClick={isMobile ? openSheet : rowSelectHandler(entry, selection, selectable)}
      // Hit-test target: mobile long-press reorder + desktop context menu (B-195).
      data-line-row={row}
    >
      <span
        className={`${styles.grip} ${styles.gripDrag}`}
        // Desktop uses native HTML5 DnD; on mobile the grip is a long-press handle instead.
        draggable={!isMobile}
        onDragStart={() => dnd.onDragStart(entry.id, row)}
        onDragEnd={dnd.onDragEnd}
        title={t('meals.line.dragHint')}
        {...touch.gripHandlers(entry.id, row)}
      />
      <NameCell name={name} isCustom={isCustom} onOpen={openEdit} />
      {isCustom ? (
        <span className={styles.qtyCustom}>
          {entry.served_grams ? `${r0(entry.served_grams)} g` : '—'}
        </span>
      ) : (
        <QtyCell mealId={mealId} mealIndex={mealIndex} entry={entry} />
      )}
      <MacroCells c={c} />
      <PinCell mealId={mealId} entryId={entry.id} isPinned={entry.is_pinned} show={showPin} />
      <button
        type="button"
        className={styles.del}
        tabIndex={-1}
        title={t('common.remove')}
        onClick={(e) => {
          e.stopPropagation(); // don't toggle row selection (B-207)
          void actions.deleteEntry(mealId, entry.id);
        }}
      >
        ×
      </button>
    </div>
  );
}

export function FoodLine({ mealId, mealIndex, row, entry, editing, dnd, touch }: FoodLineProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  const isMobile = useIsMobile();
  const referencedId = entry?.kind === 'referenced' ? entry.food_id : null;
  const food = useFood(referencedId);

  // Editing on mobile shows the bottom-sheet FoodPickerSheet (rendered by MealsOverlays) instead
  // of the inline autocomplete — so the inline path is desktop-only. ≤560px the line keeps its
  // normal entry/empty rendering while the picker overlays it.
  if (editing && !isMobile) {
    return (
      <div className={`${styles.line} ${styles.editing}`}>
        <span className={styles.grip} />
        <div className={styles.search}>
          <InlineFoodSearch
            mealId={mealId}
            mealIndex={mealIndex}
            entryId={entry?.id ?? null}
            orderIndex={row}
            initialName={food.data?.data.name ?? ''}
            currentFoodId={referencedId}
          />
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <EmptyLine
        row={row}
        dnd={dnd}
        label={t('meals.line.addFood')}
        onAdd={(q) => actions.startEdit(mealId, mealIndex, null, row, q)}
      />
    );
  }

  return (
    <EntryRow
      mealId={mealId}
      mealIndex={mealIndex}
      row={row}
      entry={entry}
      dnd={dnd}
      touch={touch}
      isMobile={isMobile}
    />
  );
}
