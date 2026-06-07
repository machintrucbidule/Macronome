import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { tableStyles } from '../../../components/DataTable/SortableTh';
import { Stars } from '../../../components/RatingStars/Stars';
import { gramsDisplay, kcalDisplay } from '../format';
import styles from '../recipes.module.css';

// One recipe row in the Recettes table (specifications/screens/recipe.md). Click opens
// the builder; the hover icon archives (or restores an archived row). Derived per-100 g
// macros + weight/portion are read from the server, never recomputed.
interface RecipeRowProps {
  recipe: RecipeSummary;
  onOpen: (recipe: RecipeSummary) => void;
  onArchive: (recipe: RecipeSummary) => void;
  onRestore: (recipe: RecipeSummary) => void;
}

export function RecipeRow({ recipe, onOpen, onArchive, onRestore }: RecipeRowProps) {
  const { t } = useTranslation();
  const archived = recipe.archived_at !== null;
  return (
    <tr
      className={`${styles.row} ${tableStyles.clickable} ${archived ? tableStyles.archived : ''}`}
      onClick={() => onOpen(recipe)}
    >
      <td>
        <span className={tableStyles.nameLabel} title={recipe.name}>
          {recipe.name}
        </span>
      </td>
      <td className={tableStyles.num}>{kcalDisplay(recipe.kcal_per_100g)}</td>
      <td className={tableStyles.numc}>{gramsDisplay(recipe.fat_per_100g)}</td>
      <td className={tableStyles.numc}>{gramsDisplay(recipe.carb_per_100g)}</td>
      <td className={tableStyles.numc}>{gramsDisplay(recipe.protein_per_100g)}</td>
      <td className={tableStyles.numc}>{gramsDisplay(recipe.total_batch_grams)}</td>
      <td className={tableStyles.numc}>{recipe.servings}</td>
      <td className={tableStyles.numc}>{gramsDisplay(recipe.weight_per_portion_g)}</td>
      <td className={tableStyles.c}>
        <Stars rating={recipe.rating} />
      </td>
      <td>
        <button
          type="button"
          className={styles.iconbtn}
          title={archived ? t('recipes.restore') : t('recipes.archive')}
          onClick={(e) => {
            e.stopPropagation();
            if (archived) onRestore(recipe);
            else onArchive(recipe);
          }}
        >
          {archived ? '↺' : '🗑'}
        </button>
      </td>
    </tr>
  );
}
