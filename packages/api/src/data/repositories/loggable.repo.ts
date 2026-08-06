import type { FoodPortion as FoodPortionModel, FoodRef as FoodRefModel } from '@prisma/client';
import type { CatalogLocale, LoggableItem } from '@macronome/shared';
import { prisma } from '../prisma.js';
import * as foodRefRepo from './food-ref.repo.js';
import { foodRepo } from './food.repo.js';
import { foodUsageMap, rankByUsage } from './food-usage.js';

// Combined log search (spec/api/foods-recipes.md §"Combined log search"). Diacritic-
// insensitive autocomplete over the user's active foods AND recipe-derived foods (the
// derived foods are `food` rows with source='recipe'). Archived rows are excluded; the
// recipe archive/restore also toggles its derived food so archived recipes drop out here.
// Ordered most-used-first over the 90-day window (FU-1/B-151), recency then name tiebreak.
//
// Since B-293 a tail of Ciqual reference entries follows the user's own results — but only when
// a search term was typed, and never at the expense of an own item (see `refTail`).

const num = (d: { toString(): string }): number => Number(d.toString());

/**
 * Over-fetch factor for the reference tail: already-owned entries are filtered out AFTER the
 * read, so asking for exactly the free slots could come back short.
 */
const REF_OVERFETCH = 3;

function refName(row: FoodRefModel, locale: CatalogLocale): string {
  return locale === 'en' ? row.nameEng : row.nameFr;
}

function refNormalized(row: FoodRefModel, locale: CatalogLocale): string {
  return locale === 'en' ? row.normalizedNameEng : row.normalizedNameFr;
}

/**
 * Reference entries to append under the user's own results (B-293).
 *
 * Two rules live here. **Only when a term was typed** — with no `q` the picker must open on the
 * user's habits, not on 3 400 alphabetical catalog rows. And **never what the user already has**
 * (D11): an entry whose normalized name matches one of their active foods is dropped entirely —
 * their own food wins, and offering both would only invite a duplicate.
 */
async function refTail(
  userId: string,
  normalized: string,
  locale: CatalogLocale,
  slots: number,
): Promise<LoggableItem[]> {
  if (slots <= 0) return [];
  const rows = await foodRefRepo.searchByName(normalized, locale, slots * REF_OVERFETCH);
  // The user-scoped half of the rule stays in food.repo, which takes `userId`; food-ref.repo
  // deliberately has no tenant (docs/architecture/security.md §6).
  const owned = await foodRepo.activeNormalizedNames(
    userId,
    rows.map((r) => refNormalized(r, locale)),
  );
  return rows
    .filter((r) => !owned.has(refNormalized(r, locale)))
    .slice(0, slots)
    .map((r) => ({
      // A food_ref id — NOT a food id. `origin` is what stops a caller confusing the two.
      id: r.id,
      name: refName(r, locale),
      kind: 'food' as const,
      origin: 'ciqual_ref' as const,
      recipe_id: null,
      named_portions: [],
    }));
}

export const loggableRepo = {
  async search(
    userId: string,
    normalized: string | undefined,
    limit: number,
    locale: CatalogLocale,
  ): Promise<LoggableItem[]> {
    // Fetch the full match set (a single user's catalog is bounded, like the AI candidate read),
    // rank by 90-day usage, then take the page — so a most-used item never falls outside a
    // name-windowed slice.
    const matches = await prisma.food.findMany({
      where: {
        ownerId: userId,
        archivedAt: null,
        ...(normalized ? { normalizedName: { contains: normalized } } : {}),
      },
    });
    const usage = await foodUsageMap(
      userId,
      matches.map((f) => f.id),
    );
    const foods = rankByUsage(matches, usage, 'desc').slice(0, limit);
    const portions = await prisma.foodPortion.findMany({
      where: { foodId: { in: foods.map((f) => f.id) } },
      orderBy: [{ label: 'asc' }],
    });
    const byFood = new Map<string, FoodPortionModel[]>();
    for (const p of portions) {
      const list = byFood.get(p.foodId);
      if (list) list.push(p);
      else byFood.set(p.foodId, [p]);
    }
    const own: LoggableItem[] = foods.map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.source === 'recipe' ? 'recipe' : 'food',
      origin: 'own',
      recipe_id: f.source === 'recipe' ? f.recipeId : null,
      named_portions: (byFood.get(f.id) ?? []).map((p) => ({
        id: p.id,
        label: p.label,
        grams: num(p.grams),
      })),
    }));

    // The catalog only ever fills what the user's own results left free — it cannot displace one.
    if (!normalized) return own;
    return [...own, ...(await refTail(userId, normalized, locale, limit - own.length))];
  },
};
