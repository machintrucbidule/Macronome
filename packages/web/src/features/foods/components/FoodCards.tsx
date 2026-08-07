import type { RefObject } from 'react';
import type { Food } from '@macronome/shared';
import { FoodCard } from './FoodCard';
import { CardSlots } from '../../../components/states/ListSlotFillers';
import type { Slot } from '../../../lib/usePagedList';
import type { IdSelection } from '../../../lib/useIdSelection';
import styles from '../foods-mobile.module.css';

// Aliments mobile card list (mobile-responsive S7). Maps the same Food rows the desktop
// FoodTable consumes into tappable cards. Mounted only inside the FoodsMobile branch.
interface FoodCardsProps {
  slots: Slot<Food>[];
  /** Slots of page 0 — the measured container holds those and nothing else (LD-1/B-303). */
  head: number;
  pitch: number;
  onOpen: (food: Food) => void;
  /** Batch selection (BE-1) — a permanent, low-contrast box at the bottom-right of each card. */
  selection: IdSelection;
  rowsRef?: RefObject<HTMLElement | null>;
}

export function FoodCards({ slots, head, pitch, onOpen, selection, rowsRef }: FoodCardsProps) {
  const card = (food: Food) => (
    <FoodCard
      key={food.id}
      food={food}
      selected={selection.isSelected(food.id)}
      onToggle={selection.toggle}
      onOpen={onOpen}
    />
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
