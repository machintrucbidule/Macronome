import type { UpdateMealEntryRequest } from '@macronome/shared';
import type { CookEdit } from '../hooks/mealActions';
import type { CookLine } from '../modals/CookModeModal/useCookSession';

// Pure diff for cook mode: compare the edited working copy against the originals and yield one
// entry patch per changed referenced line, carrying only the fields that actually changed (qty /
// unit / portion / food). Custom lines are read-only in cook mode and are skipped.
export function diffCookLines(original: CookLine[], lines: CookLine[]): CookEdit[] {
  const out: CookEdit[] = [];
  for (const line of lines) {
    if (line.kind === 'custom') continue;
    const before = original.find((o) => o.id === line.id);
    if (!before) continue;
    const body: UpdateMealEntryRequest = {};
    if (line.food_id && line.food_id !== before.food_id) body.food_id = line.food_id;
    if (line.served_quantity !== before.served_quantity)
      body.served_quantity = line.served_quantity;
    if (line.unit !== before.unit) body.unit = line.unit;
    if (line.portion_id !== before.portion_id) body.portion_id = line.portion_id;
    if (Object.keys(body).length > 0) out.push({ id: line.id, body });
  }
  return out;
}
