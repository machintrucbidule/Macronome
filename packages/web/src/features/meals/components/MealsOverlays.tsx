import { Suspense, useMemo } from 'react';
import type { Meal } from '@macronome/shared';
import { useIsMobile } from '../../../lib/useIsMobile';
import { lazyNamed } from '../../../lib/lazyNamed';
import type { CustomTarget, CustomValues, MealsController } from '../hooks/useMealsController';
import { useMeals } from '../MealsContext';
import { ClearDayConfirm } from './ClearDayConfirm';
import { CopyYesterdayConfirm } from './CopyYesterdayConfirm';
import { LeftoverModal } from '../modals/LeftoverModal/LeftoverModal';
import { FoodPickerSheet } from './FoodPickerSheet/FoodPickerSheet';
import { LineEditorSheet } from './LineEditorSheet/LineEditorSheet';

// B-266: Repas is the landing route, so anything it imports is downloaded before the first meal
// can be logged. Cook mode and the custom-line editor (which pulls the whole AI dish-analysis
// dialog and its image picker) only ever mount when the user opens them, so they load then.
const CookModeModal = lazyNamed<{ meal: Meal }>(
  () => import('../modals/CookModeModal/CookModeModal'),
  'CookModeModal',
);
const CustomFoodModal = lazyNamed<{ target: CustomTarget; initial: CustomValues | null }>(
  () => import('../modals/CustomFoodModal/CustomFoodModal'),
  'CustomFoodModal',
);

// All Repas overlays in one place (clear-day confirm + leftover / cook / custom modals), so
// MealsPage stays a thin route container. Reads the controller from context.
interface Props {
  clearing: boolean;
  onCloseClear: () => void;
  copying: boolean;
  onCloseCopy: () => void;
}

// Mobile-only overlays: the bottom-sheet food picker (replaces the inline autocomplete) and the
// bottom-sheet line editor (spec §5.3). Kept apart so they never mount on desktop (≥561px).
function MobileSheets({ ctl }: { ctl: MealsController }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return (
    <>
      {ctl.editing && <FoodPickerSheet target={ctl.editing} />}
      {ctl.lineSheetTarget && <LineEditorSheet target={ctl.lineSheetTarget} />}
    </>
  );
}

export function MealsOverlays({ clearing, onCloseClear, copying, onCloseCopy }: Props) {
  const ctl = useMeals();

  const customInitial = useMemo<CustomValues | null>(() => {
    const target = ctl.customTarget;
    if (!target) return null;
    // New line: seed from the AI dish-photo prefill when present (QP-1/B-158); edit: from the entry.
    if (!target.entryId) return target.prefill ?? null;
    if (!ctl.day) return null;
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
      {/* No fallback: these are overlays opened by a click, and their chunk lands in a frame or
          two — a placeholder panel would flash more than it would reassure. */}
      <Suspense fallback={null}>
        {cookMeal && <CookModeModal key={cookMeal.id} meal={cookMeal} />}
        {ctl.customTarget && <CustomFoodModal target={ctl.customTarget} initial={customInitial} />}
      </Suspense>
      <MobileSheets ctl={ctl} />
    </>
  );
}
