import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodRef } from '@macronome/shared';
import { CardSlots } from '../../../components/states/ListSlotFillers';
import type { Slot } from '../../../lib/usePagedList';
import { gramsDisplay, kcalDisplay } from '../format';
import { refGroup, refName } from './refName';
import cards from '../foods-mobile.module.css';

// Ciqual catalog on mobile (B-292): the Aliments card list, minus what a reference entry has
// no business with (rating, portion, usage) and plus the food group. The whole card adopts,
// exactly like the desktop row.
function CatalogCard({ ref_, onAdopt }: { ref_: FoodRef; onAdopt: (ref: FoodRef) => void }) {
  const { t, i18n } = useTranslation();
  const name = refName(ref_, i18n.language);
  return (
    <button
      type="button"
      className={cards.card}
      data-food-ref={ref_.id}
      onClick={() => onAdopt(ref_)}
    >
      <div className={cards.top}>
        <span className={cards.name} title={name}>
          {name}
        </span>
        {ref_.already_owned && (
          <span className={cards.topRight}>
            <span className={cards.archivedTag}>{t('foods.catalog.owned')}</span>
          </span>
        )}
      </div>

      <div className={cards.row}>
        <span className={cards.kcal}>
          {kcalDisplay(ref_.kcal_per_100g)} <small>{t('foods.col.kcal')}</small>
        </span>
        <span className={cards.macros}>
          <span className={cards.mFat}>{gramsDisplay(ref_.fat_per_100g)}</span>
          <span className={cards.mCarb}>{gramsDisplay(ref_.carb_per_100g)}</span>
          <span className={cards.mProt}>{gramsDisplay(ref_.protein_per_100g)}</span>
          <span className={cards.macroLegend}>L·G·P</span>
        </span>
      </div>

      <div className={cards.portion}>
        <span className={cards.portionLabel}>{t('foods.catalog.group')}</span>
        {/* One line like every other card value (LD-1/B-303 follow-up): the group label used to be
            allowed to wrap, which made cards unequal in height and the scroll reserve inexact. */}
        <span className={cards.portionValue} title={refGroup(ref_, i18n.language)}>
          {refGroup(ref_, i18n.language)}
        </span>
      </div>
    </button>
  );
}

interface CatalogCardsProps {
  slots: Slot<FoodRef>[];
  /** Slots of page 0 — the measured container holds those and nothing else (LD-1/B-303). */
  head: number;
  pitch: number;
  onAdopt: (ref: FoodRef) => void;
  rowsRef?: RefObject<HTMLElement | null>;
}

export function CatalogCards({ slots, head, pitch, onAdopt, rowsRef }: CatalogCardsProps) {
  const card = (ref_: FoodRef) => <CatalogCard key={ref_.id} ref_={ref_} onAdopt={onAdopt} />;
  return (
    <>
      <div className={cards.cardList} ref={rowsRef as RefObject<HTMLDivElement>}>
        <CardSlots slots={slots.slice(0, head)} pitch={pitch}>
          {card}
        </CardSlots>
      </div>
      <div className={cards.cardList}>
        <CardSlots slots={slots.slice(head)} pitch={pitch} offset={head}>
          {card}
        </CardSlots>
      </div>
    </>
  );
}
