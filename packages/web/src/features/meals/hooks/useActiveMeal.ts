import { useEffect, useState } from 'react';

// Active-meal selection for the mobile meal-tab layer (mobile-responsive S4, spec §5.3).
// ≤560px the Repas screen shows one meal at a time; this holds which meal index is active.
// All meal columns stay mounted — CSS hides the inactive ones — so this is pure view state,
// not a data concern. Desktop never consumes it (the tab bar is `display:none` ≥561px).
//
// Two rules from the spec: the active tab resets to the first meal on day change, and the
// index is clamped to the current meal count so a deleted meal can't leave it dangling.
export function useActiveMeal(date: string, mealCount: number): [number, (index: number) => void] {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [date]);

  const clamped = mealCount > 0 ? Math.min(activeIndex, mealCount - 1) : 0;
  return [clamped, setActiveIndex];
}
