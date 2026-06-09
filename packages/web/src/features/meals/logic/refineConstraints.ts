import {
  PORTIONLESS_GRAM_STEP,
  MAX_PORTION_COUNT,
  type MealProposal,
  type MealProposalItem,
  type MealSuggestionsRequest,
} from '@macronome/shared';

// Pure request-shaping helpers for the refine loop (mockup state 5, spec §2.6). Display/selection
// only — no nutrition computation (CLAUDE.md rule 2): the day total + fit are always recomputed and
// certified server-side. The client merely accumulates the user's exclusions / pins / "avoid"
// signatures and re-sends them on every `mealSuggestions` call.

type Constraints = NonNullable<MealSuggestionsRequest['constraints']>;
type PinnedBody = NonNullable<Constraints['pinned']>[number];

/** A food the user excluded ("Sans"); excluded by food id (removed from the candidate pool). */
export interface ExcludedFood {
  food_id: string;
  food_name: string;
}

/** A pinned line ("Fixé"): a specific proposal line held at a user-chosen quantity. */
export interface PinnedLine {
  food_id: string;
  food_name: string;
  meal_id: string;
  portion_id: string | null;
  portion_label: string | null;
  unit: 'g' | 'portion';
  /** Grams of one portion (portioned) or 1 (portionless). */
  per_portion_grams: number;
  /** Portion count (portioned) or grams (portionless). */
  count: number;
}

/** Stable key for a proposal line (food + meal + portion) — identifies a pin. */
export function lineKey(item: {
  food_id: string;
  meal_id: string;
  portion_id: string | null;
}): string {
  return `${item.food_id}|${item.meal_id}|${item.portion_id ?? 'g'}`;
}

/** Seed a pin from a proposal line at its currently-proposed quantity. */
export function pinnedFromItem(item: MealProposalItem): PinnedLine {
  const portioned = item.unit === 'portion';
  const perPortion =
    portioned && item.served_quantity > 0 ? item.served_grams / item.served_quantity : 1;
  return {
    food_id: item.food_id,
    food_name: item.food_name,
    meal_id: item.meal_id,
    portion_id: item.portion_id,
    portion_label: item.portion_label,
    unit: item.unit,
    per_portion_grams: perPortion,
    count: portioned ? item.served_quantity : item.served_grams,
  };
}

/** Step a pin: portioned by ±1 portion (clamped 1..MAX_PORTION_COUNT), portionless by ±5 g. */
export function stepPinned(line: PinnedLine, dir: 1 | -1): PinnedLine {
  if (line.unit === 'portion') {
    return { ...line, count: Math.min(MAX_PORTION_COUNT, Math.max(1, line.count + dir)) };
  }
  return {
    ...line,
    count: Math.max(PORTIONLESS_GRAM_STEP, line.count + dir * PORTIONLESS_GRAM_STEP),
  };
}

/** Grams a pin resolves to (portioned → count × per-portion grams; portionless → count grams). */
export function pinnedGrams(line: PinnedLine): number {
  return line.unit === 'portion' ? line.count * line.per_portion_grams : line.count;
}

/** Map a pin to its request body (`{ food_id, meal_id, portion_id, grams }`). */
export function pinnedToBody(line: PinnedLine): PinnedBody {
  return {
    food_id: line.food_id,
    meal_id: line.meal_id,
    portion_id: line.portion_id,
    grams: pinnedGrams(line),
  };
}

/** Sorted food-id multiset of a proposal — its "avoid" signature for variety across rounds. */
export function proposalSignature(proposal: MealProposal): string[] {
  return proposal.items.map((it) => it.food_id).sort();
}

/** Append the proposals' signatures to `avoid`, de-duplicating identical multisets. */
export function accumulateAvoid(avoid: string[][], proposals: MealProposal[]): string[][] {
  const seen = new Set(avoid.map((s) => s.join(',')));
  const next = [...avoid];
  for (const p of proposals) {
    const sig = proposalSignature(p);
    const key = sig.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      next.push(sig);
    }
  }
  return next;
}

/**
 * Assemble the `constraints` object from the accumulated client state, omitting empty arrays and
 * returning `undefined` when nothing is constrained (so the request body stays minimal).
 */
export function buildConstraints(
  excluded: ExcludedFood[],
  pinned: PinnedLine[],
  avoid: string[][],
): Constraints | undefined {
  const constraints: Constraints = {};
  if (excluded.length > 0) constraints.excluded_food_ids = excluded.map((e) => e.food_id);
  if (pinned.length > 0) constraints.pinned = pinned.map(pinnedToBody);
  if (avoid.length > 0) constraints.avoid = avoid;
  return Object.keys(constraints).length > 0 ? constraints : undefined;
}
