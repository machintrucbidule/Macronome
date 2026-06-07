import { useMemo } from 'react';
import type { CustomValues } from '../hooks/useMealsController';
import { useMeals } from '../MealsContext';
import { ClearDayConfirm } from './ClearDayConfirm';
import { CopyYesterdayConfirm } from './CopyYesterdayConfirm';
import { LeftoverModal } from '../modals/LeftoverModal/LeftoverModal';
import { CustomFoodModal } from '../modals/CustomFoodModal/CustomFoodModal';
import { CookModeModal } from '../modals/CookModeModal/CookModeModal';

// All Repas overlays in one place (clear-day confirm + leftover / cook / custom modals), so
// MealsPage stays a thin route container. Reads the controller from context.
interface Props {
  clearing: boolean;
  onCloseClear: () => void;
  copying: boolean;
  onCloseCopy: () => void;
}

export function MealsOverlays({ clearing, onCloseClear, copying, onCloseCopy }: Props) {
  const ctl = useMeals();

  const customInitial = useMemo<CustomValues | null>(() => {
    const target = ctl.customTarget;
    if (!target?.entryId || !ctl.day) return null;
    const entry = ctl.day.meals.flatMap((m) => m.entries).find((e) => e.id === target.entryId);
    if (!entry) return null;
    return {
      name: entry.custom_name ?? '',
      kcal: entry.snap.kcal,
      servedGrams: entry.served_grams,
      snap: entry.snap,
    };
  }, [ctl.customTarget, ctl.day]);

  const leftoverMeal = ctl.day?.meals.find((m) => m.id === ctl.leftoverMealId) ?? null;
  const cookMeal = ctl.day?.meals.find((m) => m.id === ctl.cookMealId) ?? null;

  return (
    <>
      {clearing && (
        <ClearDayConfirm
          onCancel={onCloseClear}
          onConfirm={() => {
            onCloseClear();
            void ctl.actions.clearDay();
          }}
        />
      )}
      {copying && (
        <CopyYesterdayConfirm
          onCancel={onCloseCopy}
          onConfirm={() => {
            onCloseCopy();
            void ctl.actions.copyYesterday();
          }}
        />
      )}
      {leftoverMeal && <LeftoverModal meal={leftoverMeal} />}
      {cookMeal && <CookModeModal key={cookMeal.id} meal={cookMeal} />}
      {ctl.customTarget && <CustomFoodModal target={ctl.customTarget} initial={customInitial} />}
    </>
  );
}
