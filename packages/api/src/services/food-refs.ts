import type { FoodRef as FoodRefModel } from '@prisma/client';
import type {
  CatalogLocale,
  FoodRef,
  FoodRefListQuery,
  FoodRefListResponse,
} from '@macronome/shared';
import * as foodRefRepo from '../data/repositories/food-ref.repo.js';
import { foodRepo } from '../data/repositories/food.repo.js';
import { normalize } from '../domain/search/normalize.js';

// Ciqual reference-catalog service (spec/api/foods-recipes.md §Food reference catalog, B-292).
//
// Orchestration only. Note the split it enforces: the catalog itself is read through
// `food-ref.repo`, which takes no `userId` (the documented tenancy exception, security.md §6),
// while the one user-scoped fact in the response — `already_owned` — comes from `food.repo`,
// which takes it like every other repository. Neither repo reaches into the other's tenancy model.

const num = (d: { toString(): string }): number => Number(d.toString());

/** The normalized name an adoption WOULD create in this locale — what `already_owned` asks about. */
function normalizedFor(row: FoodRefModel, locale: CatalogLocale): string {
  return locale === 'en' ? row.normalizedNameEng : row.normalizedNameFr;
}

function toDto(row: FoodRefModel, owned: boolean): FoodRef {
  return {
    id: row.id,
    code: row.code,
    name_fr: row.nameFr,
    name_eng: row.nameEng,
    group_label_fr: row.groupLabelFr,
    group_label_eng: row.groupLabelEng,
    kcal_per_100g: num(row.kcalPer100g),
    fat_per_100g: num(row.fatPer100g),
    carb_per_100g: num(row.carbPer100g),
    protein_per_100g: num(row.proteinPer100g),
    energy_derived: row.energyDerived,
    already_owned: owned,
  };
}

export async function list(userId: string, query: FoodRefListQuery): Promise<FoodRefListResponse> {
  const opts = query.q ? { ...query, normalized: normalize(query.q) } : query;
  const { rows, nextCursor, total } = await foodRefRepo.list(opts);
  // One probe for the whole page, on the names this locale would actually create.
  const owned = await foodRepo.activeNormalizedNames(
    userId,
    rows.map((r) => normalizedFor(r, query.locale)),
  );
  return {
    data: rows.map((r) => toDto(r, owned.has(normalizedFor(r, query.locale)))),
    next_cursor: nextCursor,
    total,
  };
}

export async function groups(locale: CatalogLocale): Promise<string[]> {
  return foodRefRepo.groups(locale);
}
