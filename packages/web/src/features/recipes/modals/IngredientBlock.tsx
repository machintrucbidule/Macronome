import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoggableItem } from '@macronome/shared';
import { useIsMobile } from '../../../lib/useIsMobile';
import { IngredientLine } from './IngredientLine';
import { IngredientPickerSheet } from './IngredientPickerSheet';
import { IngredientSearch } from './IngredientSearch';
import type { IngredientDraft } from './draft';
import styles from '../recipes.module.css';

// Ingredient builder block (specifications/screens/recipe.md): a list of ingredient lines
// + an "add ingredient" autocomplete over foods and recipes. Reuses the daily-log line
// model (name → search, qty/unit). No custom-inline ingredients.
//
// ≤560px (MOB-1) the inline autocomplete is replaced by the shared picker sheet: the lines stay as
// they are and the sheet opens over the builder. The two are mutually exclusive by construction —
// `IngredientSearch` closes on a document `mousedown` outside its own subtree, and the sheet is
// portalled to <body>, so mounting both would cancel the edit on the first tap inside the sheet.
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

// The mobile picker, for whichever of the two flows is open — swapping an existing line's item
// (pre-filled + marked current) or appending a new one. Owning the choice here keeps the block
// below free of any mobile branching beyond mounting this.
function MobileIngredientPicker({
  ingredients,
  disabledFoodId,
  adding,
  editingIndex,
  onAdd,
  onReplace,
  onCancel,
}: {
  ingredients: IngredientDraft[];
  disabledFoodId: string | null;
  adding: boolean;
  editingIndex: number | null;
  onAdd: (item: LoggableItem) => void;
  onReplace: (index: number, item: LoggableItem) => void;
  onCancel: () => void;
}) {
  const line = editingIndex === null ? null : ingredients[editingIndex];
  if (editingIndex !== null && line) {
    return (
      <IngredientPickerSheet
        disabledFoodId={disabledFoodId}
        replacing
        initialQuery={line.refName}
        currentId={line.refId}
        onPick={(item) => onReplace(editingIndex, item)}
        onClose={onCancel}
      />
    );
  }
  if (!adding) return null;
  return (
    <IngredientPickerSheet
      disabledFoodId={disabledFoodId}
      replacing={false}
      onPick={onAdd}
      onClose={onCancel}
    />
  );
}

export function IngredientBlock({ ingredients, disabledFoodId, onChange }: IngredientBlockProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
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

  // On mobile the picker is an overlay: the block below renders exactly as it does when idle, and
  // the sheet is mounted alongside it.
  const cancelPicking = (): void => {
    setAdding(false);
    setEditingIndex(null);
  };

  return (
    <>
      <div className={styles.ingBlock}>
        <div className={styles.ingHead}>
          <span>{t('recipes.builder.ingredient')}</span>
          <span>{t('recipes.builder.qtyUnit')}</span>
        </div>
        {ingredients.length === 0 && !adding && (
          <div className={styles.ingEmpty}>{t('recipes.builder.noIngredients')}</div>
        )}
        {ingredients.map((ing, i) =>
          !isMobile && editingIndex === i ? (
            <div className={styles.ingSearchRow} key={`edit-${ing.refId}-${i}`}>
              <IngredientSearch
                disabledFoodId={disabledFoodId}
                initialQuery={ing.refName}
                currentId={ing.refId}
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
        {!isMobile && adding ? (
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
      {isMobile && (
        <MobileIngredientPicker
          ingredients={ingredients}
          disabledFoodId={disabledFoodId}
          adding={adding}
          editingIndex={editingIndex}
          onAdd={add}
          onReplace={replace}
          onCancel={cancelPicking}
        />
      )}
    </>
  );
}
