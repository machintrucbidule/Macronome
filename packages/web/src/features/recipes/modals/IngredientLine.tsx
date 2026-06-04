import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecipeUnit } from '@macronome/shared';
import { UnitMenu } from './UnitMenu';
import type { IngredientDraft } from './draft';
import styles from '../recipes.module.css';

// One ingredient row in the builder (specifications/screens/recipe.md): name (read) +
// quantity + unit chip → menu + delete. Per-line macros are computed server-side and shown
// after save (live-while-typing recompute is an M9 polish item, like the Cibles tiles).
interface IngredientLineProps {
  ingredient: IngredientDraft;
  onChange: (patch: Partial<IngredientDraft>) => void;
  onRemove: () => void;
}

export function IngredientLine({ ingredient, onChange, onRemove }: IngredientLineProps) {
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

  return (
    <div className={styles.ingLine}>
      <span className={styles.ingName} title={ingredient.refName}>
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
