import type {
  CreateFoodRequest,
  Food,
  FoodListQuery,
  FoodListResponse,
  FoodParseLabel,
  FoodParseWarning,
  UpdateFoodRequest,
} from '@macronome/shared';
import {
  foodRepo,
  type FoodWithPortions,
  type FoodWriteData,
} from '../data/repositories/food.repo.js';
import { normalize } from '../domain/search/normalize.js';
import { parseLabel as parseLabelDomain } from '../domain/macro-label-parser/index.js';

// Foods service: orchestration only (CLAUDE.md — logic lives in the backend, but
// this is wiring: normalize the search key, detect the non-blocking duplicate-name
// warning, and shape the contract DTO). It never reaches into HTTP or Prisma directly
// beyond the repository.

const num = (d: { toString(): string }): number => Number(d.toString());

function toDto(row: FoodWithPortions): Food {
  return {
    id: row.id,
    owner_id: row.ownerId,
    name: row.name,
    kcal_per_100g: num(row.kcalPer100g),
    fat_per_100g: num(row.fatPer100g),
    carb_per_100g: num(row.carbPer100g),
    protein_per_100g: num(row.proteinPer100g),
    comment: row.comment,
    rating: (row.rating ?? null) as Food['rating'],
    visibility: row.visibility as Food['visibility'],
    source: row.source as Food['source'],
    ai_proposable: row.aiProposable,
    recipe_id: row.recipeId,
    named_portions: row.portions.map((p) => ({ id: p.id, label: p.label, grams: num(p.grams) })),
    archived_at: row.archivedAt ? row.archivedAt.toISOString() : null,
    ...(row.usage !== undefined ? { usage: row.usage } : {}),
  };
}

export async function list(userId: string, query: FoodListQuery): Promise<FoodListResponse> {
  const opts = query.q ? { ...query, normalized: normalize(query.q) } : query;
  // `sources` is filter-independent (B-295), so it runs alongside the page rather than after it.
  const [page, sources] = await Promise.all([
    foodRepo.list(userId, opts),
    foodRepo.distinctSources(userId),
  ]);
  return {
    data: page.rows.map(toDto),
    next_cursor: page.nextCursor,
    total: page.total,
    sources: sources as FoodListResponse['sources'],
  };
}

export async function get(userId: string, id: string): Promise<Food | null> {
  const row = await foodRepo.findById(userId, id);
  return row ? toDto(row) : null;
}

export async function create(
  userId: string,
  body: CreateFoodRequest,
): Promise<{ food: Food; warnings: string[] }> {
  const normalizedName = normalize(body.name);
  const warnings: string[] = [];
  if (await foodRepo.existsActiveByNormalizedName(userId, normalizedName)) {
    warnings.push('duplicate_name'); // non-blocking: still saved
  }
  const data: FoodWriteData = {
    name: body.name,
    normalizedName,
    kcalPer100g: body.kcal_per_100g,
    fatPer100g: body.fat_per_100g,
    carbPer100g: body.carb_per_100g,
    proteinPer100g: body.protein_per_100g,
    comment: body.comment ?? null,
    rating: body.rating,
    visibility: body.visibility,
    // How the draft was built (typed in / Chronodrive prefill / adopted Ciqual entry). Fixed
    // here and never re-written by an edit, so a Chronodrive food stays one (B-290, D7).
    source: body.source,
    aiProposable: body.ai_proposable,
    portions: body.named_portions,
  };
  const row = await foodRepo.create(userId, data);
  return { food: toDto(row), warnings };
}

// Build the patch with conditional spreads so only provided fields are written
// (undefined = leave unchanged); comment:null is meaningful (clears the comment).
function buildUpdateData(
  body: UpdateFoodRequest,
  normalizedName: string | undefined,
): Partial<FoodWriteData> {
  return {
    ...(body.name !== undefined ? { name: body.name, normalizedName: normalizedName! } : {}),
    ...(body.kcal_per_100g !== undefined ? { kcalPer100g: body.kcal_per_100g } : {}),
    ...(body.fat_per_100g !== undefined ? { fatPer100g: body.fat_per_100g } : {}),
    ...(body.carb_per_100g !== undefined ? { carbPer100g: body.carb_per_100g } : {}),
    ...(body.protein_per_100g !== undefined ? { proteinPer100g: body.protein_per_100g } : {}),
    ...(body.comment !== undefined ? { comment: body.comment } : {}),
    ...(body.rating !== undefined ? { rating: body.rating } : {}),
    ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
    // Provenance is deliberately correctable by the user (B-295); nothing else writes it here,
    // so editing a food's values never moves it on its own.
    ...(body.source !== undefined ? { source: body.source } : {}),
    ...(body.ai_proposable !== undefined ? { aiProposable: body.ai_proposable } : {}),
    ...(body.named_portions !== undefined ? { portions: body.named_portions } : {}),
  };
}

export async function update(
  userId: string,
  id: string,
  body: UpdateFoodRequest,
): Promise<{ food: Food; warnings: string[] } | null> {
  const warnings: string[] = [];
  const normalizedName = body.name !== undefined ? normalize(body.name) : undefined;
  if (normalizedName && (await foodRepo.existsActiveByNormalizedName(userId, normalizedName, id))) {
    warnings.push('duplicate_name');
  }
  const row = await foodRepo.update(userId, id, buildUpdateData(body, normalizedName));
  return row ? { food: toDto(row), warnings } : null;
}

// Stateless macro-label parser (PM-1/B-114). No DB, no user scope — pure text→numbers
// delegated to the domain; the controller maps a failure to a 422. Shapes the per-100 g
// DTO with only the macros found (a missing one is left out → the client leaves it).
export type ParseLabelOutcome =
  | { ok: true; data: FoodParseLabel; warnings: FoodParseWarning[] }
  | { ok: false; code: 'reconstituted_label' | 'no_reference' | 'unparseable' };

export function parseLabel(text: string): ParseLabelOutcome {
  const r = parseLabelDomain(text);
  if (!r.ok) return { ok: false, code: r.code };
  const data: FoodParseLabel = {
    ...(r.macros.kcal !== undefined ? { kcal_per_100g: r.macros.kcal } : {}),
    ...(r.macros.fat !== undefined ? { fat_per_100g: r.macros.fat } : {}),
    ...(r.macros.carb !== undefined ? { carb_per_100g: r.macros.carb } : {}),
    ...(r.macros.protein !== undefined ? { protein_per_100g: r.macros.protein } : {}),
  };
  return { ok: true, data, warnings: r.warnings };
}

export function archive(userId: string, id: string): Promise<boolean> {
  return foodRepo.setArchived(userId, id, true);
}

export function restore(userId: string, id: string): Promise<boolean> {
  return foodRepo.setArchived(userId, id, false);
}
