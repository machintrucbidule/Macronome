import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecipeUnit } from '@macronome/shared';
import { evalQuantity } from '../../../lib/format/parse';
import { UnitMenu } from './UnitMenu';
import type { IngredientDraft } from './draft';
import styles from '../recipes.module.css';

// One ingredient row in the builder (specifications/screens/recipe.md): name (click → search
// to change it, parity with the daily-log inline edit, B-034) + quantity + unit chip → menu +
// delete. The yield panel shows the live derived figures (B-035).
interface IngredientLineProps {
  ingredient: IngredientDraft;
  onChange: (patch: Partial<IngredientDraft>) => void;
  onEdit: () => void;
  onRemove: () => void;
}

export function IngredientLine({ ingredient, onChange, onEdit, onRemove }: IngredientLineProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const unitLabel =
    ingredient.unit === 'portion'
      ? (ingredient.namedPortions.find((p) => p.id === ingredient.portionId)?.label ?? 'portion')
      : ingredient.unit;

  const onSelectUnit = (unit: RecipeUnit, portionId: string | null): void => {
    setMenuOpen(false);
    onChange({ unit, portionId });
  };

  // Arithmetic quantity (B-108): on blur, replace an expression like "950/2" with its result;
  // invalid input is left as typed (the save-time conversion keeps the previous fallback).
  const commitQuantity = (): void => {
    const q = evalQuantity(ingredient.quantity);
    if (q !== null && q >= 0 && String(q) !== ingredient.quantity)
      onChange({ quantity: String(q) });
  };

  return (
    <div className={styles.ingLine}>
      <span
        className={styles.ingName}
        title={ingredient.refName}
        aria-label={t('recipes.builder.editIngredient')}
        onClick={onEdit}
      >
        {ingredient.refName}
      </span>
      <span className={styles.qtyCell}>
        <input
          className={`${styles.qtyInput} num`}
          value={ingredient.quantity}
          inputMode="decimal"
          aria-label={t('recipes.builder.quantity')}
          onChange={(e) => onChange({ quantity: e.target.value })}
          onFocus={(e) => e.target.select()}
          onBlur={commitQuantity}
        />
        <span className={styles.unitChip} title={unitLabel} onClick={() => setMenuOpen((o) => !o)}>
          {unitLabel}
        </span>
        {menuOpen && (
          <UnitMenu
            namedPortions={ingredient.namedPortions}
            onSelect={onSelectUnit}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </span>
      <button type="button" className={styles.rm} title={t('common.remove')} onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
