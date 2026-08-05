import type { RefObject } from 'react';
import type { RecipeSummary } from '@macronome/shared';
import { RecipeCard } from './RecipeCard';
import styles from '../recipes-mobile.module.css';

// Recettes mobile card list (mobile-responsive S6): the row→card variant of the recipe table,
// fed the same server-sorted/filtered RecipeSummary[] the desktop table consumes. A thin
// wrapper that maps rows to cards; never mounts ≥561px (desktop renders RecipesTable).
interface RecipeCardsProps {
  recipes: RecipeSummary[];
  onOpen: (recipe: RecipeSummary) => void;
  /** Rows container, measured to size the reserved scrollbar height (B-278). */
  rowsRef?: RefObject<HTMLElement | null>;
}

export function RecipeCards({ recipes, onOpen, rowsRef }: RecipeCardsProps) {
  return (
    <div className={styles.cardList} ref={rowsRef as RefObject<HTMLDivElement>}>
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} onOpen={onOpen} />
      ))}
    </div>
  );
}
