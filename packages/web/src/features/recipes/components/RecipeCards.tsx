import type { RecipeSummary } from '@macronome/shared';
import { RecipeCard } from './RecipeCard';
import styles from '../recipes-mobile.module.css';

// Recettes mobile card list (mobile-responsive S6): the row→card variant of the recipe table,
// fed the same server-sorted/filtered RecipeSummary[] the desktop table consumes. A thin
// wrapper that maps rows to cards; never mounts ≥561px (desktop renders RecipesTable).
interface RecipeCardsProps {
  recipes: RecipeSummary[];
  onOpen: (recipe: RecipeSummary) => void;
}

export function RecipeCards({ recipes, onOpen }: RecipeCardsProps) {
  return (
    <div className={styles.cardList}>
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} onOpen={onOpen} />
      ))}
    </div>
  );
}
