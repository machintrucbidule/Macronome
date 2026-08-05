import type { RefObject } from 'react';
import type { Food } from '@macronome/shared';
import { FoodCard } from './FoodCard';
import styles from '../foods-mobile.module.css';

// Aliments mobile card list (mobile-responsive S7). Maps the same Food rows the desktop
// FoodTable consumes into tappable cards. Mounted only inside the FoodsMobile branch.
interface FoodCardsProps {
  foods: Food[];
  onOpen: (food: Food) => void;
  /** Rows container, measured to size the reserved scrollbar height (B-278). */
  rowsRef?: RefObject<HTMLElement | null>;
}

export function FoodCards({ foods, onOpen, rowsRef }: FoodCardsProps) {
  return (
    <div className={styles.cardList} ref={rowsRef as RefObject<HTMLDivElement>}>
      {foods.map((food) => (
        <FoodCard key={food.id} food={food} onOpen={onOpen} />
      ))}
    </div>
  );
}
