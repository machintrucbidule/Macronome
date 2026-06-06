import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoggableItem } from '@macronome/shared';
import { IngredientLine } from './IngredientLine';
import { IngredientSearch } from './IngredientSearch';
import type { IngredientDraft } from './draft';
import styles from '../recipes.module.css';

// Ingredient builder block (specifications/screens/recipe.md): a list of ingredient lines
// + an "add ingredient" autocomplete over foods and recipes. Reuses the daily-log line
// model (name → search, qty/unit). No custom-inline ingredients.
interface IngredientBlockProps {
  ingredients: IngredientDraft[];
  disabledFoodId: string | null;
  onChange: (ingredients: IngredientDraft[]) => void;
}

function fromLoggable(item: LoggableItem): IngredientDraft {
  return {
    refType: item.kind,
    refId: item.kind === 'recipe' ? (item.recipe_id ?? item.id) : item.id,
    refName: item.name,
    namedPortions: item.named_portions.map((p) => ({ id: p.id, label: p.label, grams: p.grams })),
    quantity: '100',
    unit: 'g',
    portionId: null,
  };
}

// Replace a line's referenced item while keeping the typed quantity. The unit is kept only
// when it is a plain weight/volume (g/ml/kg); a 'portion' unit is reset because the old
// portion id does not exist on the new item.
function applyReplacement(prev: IngredientDraft, item: LoggableItem): IngredientDraft {
  const keepUnit = prev.unit !== 'portion';
  return {
    ...fromLoggable(item),
    quantity: prev.quantity,
    unit: keepUnit ? prev.unit : 'g',
    portionId: keepUnit ? prev.portionId : null,
  };
}

export function IngredientBlock({ ingredients, disabledFoodId, onChange }: IngredientBlockProps) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const update = (i: number, patch: Partial<IngredientDraft>): void =>
    onChange(ingredients.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));
  const remove = (i: number): void => onChange(ingredients.filter((_, idx) => idx !== i));
  const add = (item: LoggableItem): void => {
    onChange([...ingredients, fromLoggable(item)]);
    setAdding(false);
  };
  const replace = (i: number, item: LoggableItem): void => {
    onChange(ingredients.map((ing, idx) => (idx === i ? applyReplacement(ing, item) : ing)));
    setEditingIndex(null);
  };

  return (
    <div className={styles.ingBlock}>
      <div className={styles.ingHead}>
        <span>{t('recipes.builder.ingredient')}</span>
        <span>{t('recipes.builder.qtyUnit')}</span>
      </div>
      {ingredients.length === 0 && !adding && (
        <div className={styles.ingEmpty}>{t('recipes.builder.noIngredients')}</div>
      )}
      {ingredients.map((ing, i) =>
        editingIndex === i ? (
          <div className={styles.ingSearchRow} key={`edit-${ing.refId}-${i}`}>
            <IngredientSearch
              disabledFoodId={disabledFoodId}
              onPick={(item) => replace(i, item)}
              onClose={() => setEditingIndex(null)}
            />
          </div>
        ) : (
          <IngredientLine
            key={`${ing.refId}-${i}`}
            ingredient={ing}
            onChange={(patch) => update(i, patch)}
            onEdit={() => setEditingIndex(i)}
            onRemove={() => remove(i)}
          />
        ),
      )}
      {adding ? (
        <div className={styles.ingSearchRow}>
          <IngredientSearch
            disabledFoodId={disabledFoodId}
            onPick={add}
            onClose={() => setAdding(false)}
          />
        </div>
      ) : (
        <button type="button" className={styles.addIng} onClick={() => setAdding(true)}>
          {t('recipes.builder.addIngredient')}
        </button>
      )}
    </div>
  );
}
