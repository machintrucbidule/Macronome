import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../domain/search/normalize.js';
import type { CiqualSeedFile } from '../domain/ciqual/index.js';
import * as foodRefRepo from '../data/repositories/food-ref.repo.js';
import { logger } from '../observability/logger.js';

// Boot-time seeder for the global Ciqual reference catalog (spec/logic/ciqual-catalog.md §6).
//
// Zero-config and automatic on upgrade, like the auto-generated session secret: the extract
// committed with the source carries a `dataset` marker; if it matches what is already stored,
// nothing happens, otherwise the whole table is replaced in one transaction. Re-running is
// therefore free, and a new edition is a re-run of scripts/build-ciqual-seed.ts plus a new id.
//
// Called from server.ts BEFORE listen (so the app never serves a half-written catalog), never
// from createApp() — integration tests import createApp and must stay inert.

const SEED_FILE = 'ciqual_2025.json';

/**
 * Locate the committed extract by walking up from this module until `data/<file>` appears.
 * The depth differs between `src/services/` (dev, tsx) and `dist/src/services/` (the image),
 * so the file itself is the landmark rather than a hard-coded number of `..`.
 */
export function seedFilePath(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, 'data', SEED_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate data/${SEED_FILE} from ${import.meta.url}`);
}

/** Read the committed extract. Not validated at runtime — `seed-file.test.ts` is the gate. */
function readSeedFile(): CiqualSeedFile {
  return JSON.parse(readFileSync(seedFilePath(), 'utf8')) as CiqualSeedFile;
}

export interface SeedResult {
  dataset: string;
  /** False when the stored edition already matched and nothing was written. */
  replaced: boolean;
  count: number;
}

/**
 * Bring `food_ref` in line with the extract shipped in this build. Idempotent: a second call
 * with the same dataset id writes nothing.
 */
export async function seedFoodRefCatalog(): Promise<SeedResult> {
  const file = readSeedFile();
  const stored = await foodRefRepo.currentDataset();
  if (stored === file.dataset) {
    return { dataset: file.dataset, replaced: false, count: await foodRefRepo.count() };
  }

  // Normalized names are computed here, not in the extract, so they use the very same helper
  // as food.normalized_name — that byte-for-byte equality is what the duplicate rule relies on.
  const rows = file.entries.map((e) => ({
    dataset: file.dataset,
    code: e.code,
    nameFr: e.name_fr,
    nameEng: e.name_eng,
    normalizedNameFr: normalize(e.name_fr),
    normalizedNameEng: normalize(e.name_eng),
    groupLabelFr: e.group_fr,
    groupLabelEng: e.group_eng,
    kcalPer100g: e.kcal,
    fatPer100g: e.fat,
    carbPer100g: e.carb,
    proteinPer100g: e.protein,
    energyDerived: e.derived,
  }));
  logger.info({ dataset: file.dataset, previous: stored }, 'Replacing the Ciqual catalog');
  await foodRefRepo.replaceAll(rows);
  return { dataset: file.dataset, replaced: true, count: rows.length };
}
