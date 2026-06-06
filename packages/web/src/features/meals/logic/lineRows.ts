import type { MealEntry } from '@macronome/shared';

// Positional meal lines (B-028): an entry's order_index is its visual row, so the user can
// add into any empty row and intentionally leave blank rows above. This view-only helper
// places each entry at its row and exposes the remaining rows as empties — keeping ≥2
// trailing empty rows after the last filled one and ≥ minLines total. Pure (no I/O).
export interface LineRow {
  row: number;
  entry: MealEntry | null;
}

const TRAILING_EMPTY = 2;

export function buildLineRows(entries: MealEntry[], minLines: number): LineRow[] {
  const byRow = new Map<number, MealEntry>();
  const overflow: MealEntry[] = [];
  let maxRow = -1;
  for (const e of entries) {
    if (byRow.has(e.order_index)) {
      overflow.push(e); // defensive: duplicate order_index never happens via the UI
    } else {
      byRow.set(e.order_index, e);
      if (e.order_index > maxRow) maxRow = e.order_index;
    }
  }
  for (const e of overflow) {
    maxRow += 1;
    byRow.set(maxRow, e);
  }
  const rowCount = Math.max(minLines, maxRow + 1 + TRAILING_EMPTY);
  const rows: LineRow[] = [];
  for (let row = 0; row < rowCount; row++) rows.push({ row, entry: byRow.get(row) ?? null });
  return rows;
}
