import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EntryUnit, PantryItem } from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { Autocomplete } from '../../../components/Form/Autocomplete/Autocomplete';
import { usePantryMutations } from '../usePantry';
import { useFoodSearch } from '../useFoodPicker';
import { PantryFoodChip } from './PantryFoodChip';
import styles from '../settings.module.css';

// Per-meal garde-manger editor (screens/settings.md): pinned foods as removable chips (each
// with a prefill-unit chip/menu, GM-2/B-094) + an inline food picker to add one. Same
// pantry_item data as the Repas 📌; edits affect future-day prefill only. A duplicate pin
// surfaces the contract's 409 message. The picker closes on an outside click (B-095, B-049 pattern).
interface Props {
  mealSlotName: string;
  items: PantryItem[];
}

export function PantryEditor({ mealSlotName, items }: Props) {
  const { t } = useTranslation();
  const { create, update, remove } = usePantryMutations();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const search = useFoodSearch(q, picking);
  const pickerRef = useRef<HTMLDivElement>(null);

  // B-095: clicking outside the food picker closes it (no food added), mirroring the Repas
  // InlineFoodSearch / recipes IngredientSearch outside-click (B-049).
  useEffect(() => {
    if (!picking) return;
    const onDown = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicking(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [picking]);

  const pinnedIds = new Set(items.map((i) => i.food_id));
  const options = (search.data?.data ?? [])
    .filter((f) => !pinnedIds.has(f.id))
    .map((f) => ({ id: f.id, name: f.name }));

  const add = async (foodId: string): Promise<void> => {
    setError(null);
    try {
      await create.mutateAsync({ meal_slot_name: mealSlotName, food_id: foodId });
      setPicking(false);
      setQ('');
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? t('settings.pantry.duplicate') : null);
    }
  };

  const setUnit = (id: string, unit: EntryUnit, portionId: string | null): void => {
    update.mutate({ id, body: { unit, portion_id: portionId } });
  };

  return (
    <div className={styles.pantry}>
      <div className={styles.pantryHead}>{t('settings.pantry.title')}</div>
      <div className={styles.chips}>
        {items.map((item) => (
          <PantryFoodChip
            key={item.id}
            item={item}
            onRemove={() => remove.mutate(item.id)}
            onSetUnit={(unit, portionId) => setUnit(item.id, unit, portionId)}
          />
        ))}
        {!picking && (
          <button type="button" className={styles.addChip} onClick={() => setPicking(true)}>
            {t('settings.pantry.add')}
          </button>
        )}
      </div>
      {picking && (
        <div className={styles.picker} ref={pickerRef}>
          <Autocomplete
            query={q}
            onQueryChange={setQ}
            items={options}
            emptyLabel={t('settings.pantry.searchEmpty')}
            placeholder={t('settings.pantry.searchPlaceholder')}
            onPick={(item) => void add(item.id)}
            onClose={() => setPicking(false)}
          />
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
