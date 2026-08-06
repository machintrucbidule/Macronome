import type { CreateFoodSource, FoodSource } from '@macronome/shared';

// Source filter vocabulary + availability rule, shared by the desktop popover and the mobile
// sheet so the two cannot drift (B-291/B-295).

export type SourceFilter = 'all' | CreateFoodSource;

/**
 * The chips to offer, from the provenances `GET /foods` reports as actually present.
 *
 * Two rules, both from the owner: a provenance is offered only when at least one food carries
 * it, and the whole filter disappears below two — filtering on the single source everything
 * already has cannot change the list, so the block would be dead weight. It reappears on its own
 * the day a second provenance shows up.
 *
 * @returns the chips in display order, or an empty array meaning "render no Source block".
 */
export function sourceFilterOptions(sources: FoodSource[]): SourceFilter[] {
  // `recipe` never reaches the Aliments list (food.repo excludes it), but the response type
  // allows it — drop it here rather than trust the server to have.
  const present = sources.filter((s): s is CreateFoodSource => s !== 'recipe');
  return present.length >= 2 ? ['all', ...present] : [];
}
