import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CiqualSeedFile } from './index.js';
import { seedFilePath } from '../../services/ciqual-seed.js';

// Guards the COMMITTED extract itself (packages/api/data/ciqual_2025.json), which the boot
// seeder trusts at runtime rather than re-validating on every start. Regenerating it with
// scripts/build-ciqual-seed.ts must keep every property below true; the counts are the figures
// measured against the real 2025 distribution (spec/logic/ciqual-catalog.md).
const file = JSON.parse(readFileSync(seedFilePath(), 'utf8')) as CiqualSeedFile;

const EXPECTED_ENTRIES = 3400;
const EXPECTED_DERIVED = 59;
const EXPECTED_GROUPS = 12; // the 11 Ciqual level-1 groups + "non classé" (§5)

describe('committed Ciqual extract', () => {
  it('carries the dataset marker the seeder compares', () => {
    expect(file.dataset).toBe('ciqual_2025');
    expect(file.source).toContain('Licence Ouverte');
  });

  it('holds the measured number of entries, of which the expected few are derived', () => {
    expect(file.entries).toHaveLength(EXPECTED_ENTRIES);
    expect(file.entries.filter((e) => e.derived)).toHaveLength(EXPECTED_DERIVED);
  });

  it('has a unique code per entry', () => {
    expect(new Set(file.entries.map((e) => e.code)).size).toBe(EXPECTED_ENTRIES);
  });

  it('labels every entry with a group, in both languages', () => {
    expect(file.entries.filter((e) => !e.group_fr || !e.group_eng)).toEqual([]);
    expect(new Set(file.entries.map((e) => e.group_fr)).size).toBe(EXPECTED_GROUPS);
  });

  it('names every entry in both languages', () => {
    expect(file.entries.filter((e) => !e.name_fr || !e.name_eng)).toEqual([]);
  });

  it('carries four finite, non-negative macros per entry (the NOT NULL / CHECK >= 0 columns)', () => {
    const bad = file.entries.filter((e) =>
      [e.kcal, e.fat, e.carb, e.protein].some((v) => !Number.isFinite(v) || v < 0),
    );
    expect(bad).toEqual([]);
  });
});
