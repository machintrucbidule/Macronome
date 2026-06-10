import type { Food } from '@macronome/shared';
import { FoodCard } from './FoodCard';
import styles from '../foods-mobile.module.css';

// Aliments mobile card list (mobile-responsive S7). Maps the same Food rows the desktop
// FoodTable consumes into tappable cards. Mounted only inside the FoodsMobile branch.
interface FoodCardsProps {
  foods: Food[];
  onOpen: (food: Food) => void;
}

export function FoodCards({ foods, onOpen }: FoodCardsProps) {
  return (
    <div className={styles.cardList}>
      {foods.map((food) => (
        <FoodCard key={food.id} food={food} onOpen={onOpen} />
      ))}
    </div>
  );
}
