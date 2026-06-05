import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PantryItem } from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { Autocomplete } from '../../../components/Form/Autocomplete/Autocomplete';
import { usePantryMutations } from '../usePantry';
import { useFoodSearch } from '../useFoodPicker';
import styles from '../settings.module.css';

// Per-meal garde-manger editor (screens/settings.md): pinned foods as removable chips + an
// inline food picker to add one. Same pantry_item data as the Repas 📌; edits affect
// future-day prefill only. A duplicate pin surfaces the contract's 409 message.
interface Props {
  mealSlotName: string;
  items: PantryItem[];
  foodName: (id: string) => string;
}

export function PantryEditor({ mealSlotName, items, foodName }: Props) {
  const { t } = useTranslation();
  const { create, remove } = usePantryMutations();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const search = useFoodSearch(q, picking);

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

  return (
    <div className={styles.pantry}>
      <div className={styles.pantryHead}>{t('settings.pantry.title')}</div>
      <div className={styles.chips}>
        {items.map((item) => (
          <span key={item.id} className={styles.chip}>
            {foodName(item.food_id)}
            <button type="button" title={t('common.remove')} onClick={() => remove.mutate(item.id)}>
              ×
            </button>
          </span>
        ))}
        {!picking && (
          <button type="button" className={styles.addChip} onClick={() => setPicking(true)}>
            {t('settings.pantry.add')}
          </button>
        )}
      </div>
      {picking && (
        <div className={styles.picker}>
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
