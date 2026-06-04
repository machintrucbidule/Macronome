// Keyboard navigation across quantity cells (specifications/screens/meals.md §Interactions).
// Quantity inputs are tagged `data-meal-qty`; Tab/Shift+Tab and edge arrows move between them
// in document order — a serpentine flow down each meal column and across columns. View-only.
const SELECTOR = 'input[data-meal-qty]';

function qtyInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(SELECTOR));
}

/** Move focus to the previous/next quantity input relative to `current`. */
export function focusSiblingQty(current: HTMLInputElement, dir: 1 | -1): void {
  const all = qtyInputs();
  const idx = all.indexOf(current);
  if (idx < 0) return;
  const next = all[idx + dir];
  if (next) {
    next.focus();
    next.select();
  } else {
    current.blur();
  }
}

/** True when the text caret sits at the very start (-1) or end (+1) of the field. */
export function caretAtEdge(input: HTMLInputElement, dir: 1 | -1): boolean {
  const pos = input.selectionStart ?? 0;
  return dir === -1 ? pos <= 0 : pos >= input.value.length;
}
