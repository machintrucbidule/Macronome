import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreatePantryRequest, EntryUnit, PantryItem } from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { Autocomplete } from '../../../components/Form/Autocomplete/Autocomplete';
import { useIsMobile } from '../../../lib/useIsMobile';
import { usePantryMutations } from '../usePantry';
import { notifyUndoable } from '../../../components/Toast/notify';
import { useFoodSearch } from '../useFoodPicker';
import { PantryFoodChip } from './PantryFoodChip';
import { PantryPickerSheet } from './PantryPickerSheet';
import styles from '../settings.module.css';
import { usePickLoggable } from '../../foods/usePickLoggable';
import type { TFunction } from 'i18next';
import type { LoggableItem } from '@macronome/shared';
import type { SearchSheetItem } from '../../../components/SearchSheet';

// Per-meal garde-manger editor (screens/settings.md): pinned foods as removable chips (each
// with a prefill-unit chip/menu, GM-2/B-094) + a food picker to add one. Same pantry_item data as
// the Repas 📌; edits affect future-day prefill only. A duplicate pin surfaces the contract's 409
// message.
//
// The picker is the inline dropdown on desktop, closing on an outside click (B-095, B-049 pattern),
// and the shared picker sheet at ≤560px (MOB-1) — this screen's first mobile-specific behaviour.
// Exactly one of the two is ever mounted: the outside-click listener is bound to this card's
// subtree, and the sheet is portalled to <body>, so together they would dismiss on the first tap
// inside the sheet.
interface Props {
  mealSlotName: string;
  items: PantryItem[];
}

/** B-095: clicking outside the food picker closes it (no food added), mirroring the Repas
 *  InlineFoodSearch / recipes IngredientSearch outside-click (B-049). The caller passes
 *  `active: false` on mobile — the sheet is portalled outside this card, so the listener would
 *  otherwise fire on the first tap inside it. `setOpen` is a useState setter, hence stable. */
function useOutsideClose(
  active: boolean,
  ref: RefObject<HTMLDivElement | null>,
  setOpen: (open: boolean) => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [active, ref, setOpen]);
}

/** The pin exactly as it was, so an undo re-creates it in place (B-261). */
const restoreBody = (item: PantryItem): CreatePantryRequest => ({
  meal_slot_name: item.meal_slot_name,
  food_id: item.food_id,
  unit: item.unit,
  portion_id: item.portion_id,
  order_index: item.order_index,
});

/** Picker rows: already-pinned foods filtered out, the recipe tag, and the Ciqual provenance
 *  chip on entries that are not the user's foods yet (B-293). */
function pickerOptions(
  results: LoggableItem[],
  items: PantryItem[],
  t: TFunction,
): SearchSheetItem[] {
  const pinnedIds = new Set(items.map((i) => i.food_id));
  return results
    .filter((f) => !pinnedIds.has(f.id))
    .map((f) => ({
      id: f.id,
      name: f.name,
      ...(f.kind === 'recipe' ? { tag: t('recipes.builder.recipeTag') } : {}),
      ...(f.origin === 'ciqual_ref' ? { hint: t('foods.source.ciqual') } : {}),
    }));
}

export function PantryEditor({ mealSlotName, items }: Props) {
  const { t } = useTranslation();
  const { create, update, remove } = usePantryMutations();
  const isMobile = useIsMobile();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const search = useFoodSearch(q, picking);
  const { resolve } = usePickLoggable();
  const pickerRef = useRef<HTMLDivElement>(null);

  useOutsideClose(picking && !isMobile, pickerRef, setPicking);

  const results = search.data?.data ?? [];
  const options = pickerOptions(results, items, t);

  const add = async (id: string): Promise<void> => {
    setError(null);
    const hit = results.find((r) => r.id === id);
    if (!hit) return;
    try {
      // A Ciqual entry becomes a real food before it can be pinned (B-293).
      const picked = await resolve(hit);
      await create.mutateAsync({ meal_slot_name: mealSlotName, food_id: picked.id });
      setPicking(false);
      setQ('');
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? t('settings.pantry.duplicate') : null);
    }
  };

  const setUnit = (id: string, unit: EntryUnit, portionId: string | null): void => {
    update.mutate({ id, body: { unit, portion_id: portionId } });
  };
  const closePicker = (): void => setPicking(false);

  // B-261: undo re-pins the food with its prefill unit AND its position — POST /pantry gained
  // order_index for exactly this (owner-approved), so the chip does not come back at the end.
  const unpin = (item: PantryItem): void =>
    remove.mutate(item.id, {
      onSuccess: () =>
        notifyUndoable('pantryPinRemoved', () => create.mutateAsync(restoreBody(item))),
    });

  return (
    <div className={styles.pantry}>
      <div className={styles.pantryHead}>{t('settings.pantry.title')}</div>
      <div className={styles.chips}>
        {items.map((item) => (
          <PantryFoodChip
            key={item.id}
            item={item}
            onRemove={() => unpin(item)}
            onSetUnit={(unit, portionId) => setUnit(item.id, unit, portionId)}
          />
        ))}
        {!picking && (
          <button type="button" className={styles.addChip} onClick={() => setPicking(true)}>
            {t('settings.pantry.add')}
          </button>
        )}
      </div>
      {picking && !isMobile && (
        <div className={styles.picker} ref={pickerRef}>
          <Autocomplete
            query={q}
            onQueryChange={setQ}
            items={options}
            emptyLabel={t('settings.pantry.searchEmpty')}
            placeholder={t('settings.pantry.searchPlaceholder')}
            onPick={(item) => void add(item.id)}
            onClose={closePicker}
          />
        </div>
      )}
      {picking && isMobile && (
        <PantryPickerSheet
          query={q}
          onQueryChange={setQ}
          items={options}
          onPick={(item) => void add(item.id)}
          onClose={closePicker}
        />
      )}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
