// Integer-fit column layout for the meal scroller (specifications/screens/meals.md §Layout):
// an integer number of columns fills the available width with no wasted margin. View-only
// geometry — no domain logic. `n = round(width / TARGET)`, `colWidth = floor(width / n)`.
export const TARGET_COL_WIDTH = 400;

// B-244: the plain rounding needs 1400px of usable width for 4 columns, so a 1280px window laid
// out 3 columns for 4 meals and hid the last one behind a scroll. `minColumns` (a user setting)
// raises the count — but only while each column still gets MIN_VIABLE_COL_WIDTH: the meal line is
// a 9-column grid of which 255px are incompressible, everything above that being the food-name
// column, which would go negative and break the grid on a narrow window. The minimum therefore
// never applies below this floor, and never *reduces* the automatic count.
export const MIN_VIABLE_COL_WIDTH = 300;

// Fallback used while the user setting loads — mirrors the server default (services/settings.ts
// STORED_DEFAULTS.min_meal_columns), like DEFAULT_LINES_DESKTOP does for the line floor.
export const DEFAULT_MIN_MEAL_COLUMNS = 4;

export function columnFit(
  availableWidth: number,
  minColumns = 1,
  target = TARGET_COL_WIDTH,
): {
  columns: number;
  colWidth: number;
} {
  const width = Math.max(0, availableWidth);
  const viable = Math.floor(width / MIN_VIABLE_COL_WIDTH);
  const columns = Math.max(1, Math.round(width / target), Math.min(minColumns, viable));
  const colWidth = Math.floor(width / columns);
  return { columns, colWidth };
}

// Genuine horizontal overflow ⇔ there are more meals than the integer-fit columns that fill the
// width. DOM-free predicate (B-075): reading `scrollWidth > clientWidth` over-triggered on the
// sub-pixel `floor` residual / per-column border after a resize, leaving a phantom scrollbar.
// Shares columnFit, so the ‹ › arrows and the custom scrollbar follow the minimum-columns setting
// by construction.
export function hasOverflow(
  availableWidth: number,
  mealCount: number,
  minColumns = 1,
  target = TARGET_COL_WIDTH,
): boolean {
  return mealCount > columnFit(availableWidth, minColumns, target).columns;
}
