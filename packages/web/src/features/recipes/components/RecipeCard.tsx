import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { Stars } from '../../../components/RatingStars/Stars';
import { SelectCheckbox } from '../../../components/BulkEdit';
import { gramsDisplay, gramsInt, kcalDisplay } from '../format';
import styles from '../recipes-mobile.module.css';

// One recipe card in the Recettes mobile list (mobile-responsive S6, mockups/03-recipes.html).
// Tapping the card body opens the bottom-sheet builder (edit). Archive / restore is reached
// inside the builder footer (owner decision 2026-06-10) — no per-card control. Derived per-100 g
// macros + weight/portion come from the server, never recomputed (CLAUDE.md rule 2).
//
// BE-1/B-308: the root is no longer the button — a selection checkbox cannot be nested in one.
interface RecipeCardProps {
  recipe: RecipeSummary;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen: (recipe: RecipeSummary) => void;
}

export function RecipeCard({ recipe, selected, onToggle, onOpen }: RecipeCardProps) {
  const { t } = useTranslation();
  const archived = recipe.archived_at !== null;
  return (
    <div
      className={`${styles.card} ${archived ? styles.archived : ''} ${
        selected ? styles.cardSelected : ''
      }`}
      data-recipe={recipe.id}
    >
      <button type="button" className={styles.cardBody} onClick={() => onOpen(recipe)}>
        <div className={styles.top}>
          <span className={styles.name} title={recipe.name}>
            {recipe.name}
          </span>
          <span className={styles.topRight}>
            {archived && <span className={styles.archivedTag}>{t('recipes.archivedTag')}</span>}
            <Stars rating={recipe.rating} />
          </span>
        </div>

        <div className={styles.row}>
          <span className={styles.kcal}>
            {kcalDisplay(recipe.kcal_per_100g)} <small>{t('recipes.col.kcal')}</small>
          </span>
          <span className={styles.macros}>
            <span className={styles.mFat}>{gramsDisplay(recipe.fat_per_100g)}</span>
            <span className={styles.mCarb}>{gramsDisplay(recipe.carb_per_100g)}</span>
            <span className={styles.mProt}>{gramsDisplay(recipe.protein_per_100g)}</span>
            <span className={styles.macroLegend}>L·G·P</span>
          </span>
        </div>

        <div className={styles.meta}>
          <span className={styles.kv}>
            <span className={styles.k}>{t('recipes.col.batch')}</span>
            <b>{gramsInt(recipe.total_batch_grams)}</b>
          </span>
          <span className={styles.kv}>
            <span className={styles.k}>{t('recipes.col.servings')}</span>
            <b>{recipe.servings}</b>
          </span>
          <span className={styles.kv}>
            <span className={styles.k}>{t('recipes.col.weightPerPortion')}</span>
            <b>{gramsInt(recipe.weight_per_portion_g)}</b>
          </span>
        </div>
      </button>
      <SelectCheckbox
        variant="card"
        checked={selected}
        onChange={() => onToggle(recipe.id)}
        ariaLabel={t('bulk.selectRow', { name: recipe.name })}
      />
    </div>
  );
}
