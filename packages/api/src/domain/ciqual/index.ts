// Ciqual reference catalog — pure extraction logic (spec/logic/ciqual-catalog.md).
// Used offline by scripts/build-ciqual-seed.ts to produce the committed extract, and by
// services/ciqual-seed.ts to read it back. No I/O here.

export { parseTeneur, TENEUR_UNKNOWN } from './parse-teneur.js';
export { buildCatalogMacros } from './build-entry.js';
export type { CiqualValues, CiqualMacros } from './build-entry.js';

/** Constituent codes read from the composition table (§2). */
export const CIQUAL_CONST = {
  /** Energy, Regulation EU No 1169/2011 (kcal/100 g). Never 327 (kJ) or 333 (with fibres). */
  kcal: '328',
  fat: '40000',
  carb: '31000',
  protein: '25000',
} as const;

/** One row of the committed extract (snake_case: it is a data file, not a DTO). */
export interface CiqualSeedEntry {
  /** Ciqual `alim_code`, kept as text (zero-padded). */
  code: string;
  name_fr: string;
  name_eng: string;
  /** Level-1 food group labels (11 of them); sub-groups are not stored. */
  group_fr: string;
  group_eng: string;
  kcal: number;
  fat: number;
  carb: number;
  protein: number;
  /** kcal was derived from the macros rather than published (§4.2). */
  derived: boolean;
}

/** The committed extract as a whole. `dataset` is the marker the boot seeder compares (§6). */
export interface CiqualSeedFile {
  dataset: string;
  /** Human-readable provenance line (edition, producer, licence, DOI) — attribution, not data. */
  source: string;
  entries: CiqualSeedEntry[];
}
