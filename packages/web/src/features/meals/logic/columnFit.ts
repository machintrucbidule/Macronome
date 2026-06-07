// Integer-fit column layout for the meal scroller (specifications/screens/meals.md §Layout):
// an integer number of columns fills the available width with no wasted margin. View-only
// geometry — no domain logic. `n = round(width / TARGET)`, `colWidth = floor(width / n)`.
export const TARGET_COL_WIDTH = 400;

export function columnFit(
  availableWidth: number,
  target = TARGET_COL_WIDTH,
): {
  columns: number;
  colWidth: number;
} {
  const width = Math.max(0, availableWidth);
  const columns = Math.max(1, Math.round(width / target));
  const colWidth = Math.floor(width / columns);
  return { columns, colWidth };
}

// Genuine horizontal overflow ⇔ there are more meals than the integer-fit columns that fill the
// width. DOM-free predicate (B-075): reading `scrollWidth > clientWidth` over-triggered on the
// sub-pixel `floor` residual / per-column border after a resize, leaving a phantom scrollbar.
export function hasOverflow(
  availableWidth: number,
  mealCount: number,
  target = TARGET_COL_WIDTH,
): boolean {
  return mealCount > columnFit(availableWidth, target).columns;
}
