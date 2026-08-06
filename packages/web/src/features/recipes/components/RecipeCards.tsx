import type { RefObject } from 'react';
import type { RecipeSummary } from '@macronome/shared';
import { RecipeCard } from './RecipeCard';
import { CardSlots } from '../../../components/states/ListSlotFillers';
import type { Slot } from '../../../lib/usePagedList';
import styles from '../recipes-mobile.module.css';

// Recettes mobile card list (mobile-responsive S6): the row→card variant of the recipe table,
// fed the same server-sorted/filtered RecipeSummary[] the desktop table consumes. A thin
// wrapper that maps rows to cards; never mounts ≥561px (desktop renders RecipesTable).
interface RecipeCardsProps {
  slots: Slot<RecipeSummary>[];
  /** Slots of page 0 — the measured container holds those and nothing else (LD-1/B-303). */
  head: number;
  pitch: number;
  onOpen: (recipe: RecipeSummary) => void;
  rowsRef?: RefObject<HTMLElement | null>;
}

export function RecipeCards({ slots, head, pitch, onOpen, rowsRef }: RecipeCardsProps) {
  const card = (recipe: RecipeSummary) => (
    <RecipeCard key={recipe.id} recipe={recipe} onOpen={onOpen} />
  );
  return (
    <>
      <div className={styles.cardList} ref={rowsRef as RefObject<HTMLDivElement>}>
        <CardSlots slots={slots.slice(0, head)} pitch={pitch}>
          {card}
        </CardSlots>
      </div>
      <div className={styles.cardList}>
        <CardSlots slots={slots.slice(head)} pitch={pitch} offset={head}>
          {card}
        </CardSlots>
      </div>
    </>
  );
}
