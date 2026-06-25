import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EntryUnit, PantryItem } from '@macronome/shared';
import { UnitMenu } from '../../meals/components/FoodLine/UnitMenu';
import { useFood } from '../../meals/hooks/useFoodLookup';
import styles from '../settings.module.css';

// One pinned garde-manger food (GM-2/B-094): name + a unit chip opening the Repas UnitMenu
// (SI units + this food's named portions) + a remove button. Choosing a unit persists the
// pin's prefill unit and cascades to today/future placeholder lines (the API does the cascade).
// The food name + portions are resolved per id via useFood (the Repas pattern), so every
// pinned food is named regardless of how many foods exist (B-102: no capped foods index).
interface Props {
  item: PantryItem;
  onRemove: () => void;
  onSetUnit: (unit: EntryUnit, portionId: string | null) => void;
}

export function PantryFoodChip({ item, onRemove, onSetUnit }: Props) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const food = useFood(item.food_id);
  const portions = food.data?.data.named_portions ?? [];

  const unitLabel =
    item.unit === 'portion'
      ? (portions.find((p) => p.id === item.portion_id)?.label ?? t('settings.pantry.portion'))
      : item.unit;

  return (
    <span className={styles.chip}>
      {food.data?.data.name ?? '…'}
      <span className={styles.unitWrap}>
        <button
          type="button"
          className={styles.unitChip}
          title={t('settings.pantry.unit')}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {unitLabel}
        </button>
        {menuOpen && (
          <UnitMenu
            foodId={item.food_id}
            currentUnit={item.unit}
            currentPortionId={item.portion_id}
            onSelect={(unit, portionId) => {
              onSetUnit(unit, portionId);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </span>
      <button
        type="button"
        title={t('common.remove')}
        onClick={onRemove}
        data-testid="pantry-remove"
      >
        ×
      </button>
    </span>
  );
}
