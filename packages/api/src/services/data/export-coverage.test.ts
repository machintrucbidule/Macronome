import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { DataExportEnvelopeSchema } from '@macronome/shared';
import { z } from 'zod';

// Anti-omission guard for the IMP-1 export/import envelope (DECISIONS "Export/import envelope
// audit"). Two silent gaps (RW-1 batch_weight_auto, GM-2 pantry unit, then food.ai_proposable)
// reached prod because the round-trip test only catches a dropped column when the fixture uses a
// NON-default value. This test removes the human-vigilance requirement: it compares every scalar
// column of every exportable Prisma table to the envelope schema, and FAILS the build when a
// column is neither exported nor in the explicit, documented exclusion whitelist. Adding a new
// column therefore forces a conscious decision (export it, or whitelist it).

// Each Prisma table (its @@map db name) → the envelope array key whose element lists its columns.
const TABLE_TO_ENVELOPE: Record<string, string> = {
  food: 'foods',
  food_portion: 'food_portions',
  recipe: 'recipes',
  recipe_ingredient: 'recipe_ingredients',
  pantry_item: 'pantry_items',
  target: 'targets',
  container: 'containers',
  weight_entry: 'weight_entries',
  meal_slot_template: 'meal_templates',
  day_log: 'day_logs',
  meal: 'meals',
  meal_entry: 'meal_entries',
  leftover_group: 'leftover_groups',
  leftover_group_entry: 'leftover_group_entries',
};

// app_user is projected (not a 1:1 array): its exported columns live in `profile` + `settings`.
const APP_USER_EXPORTED = new Set(['sex', 'birthdate', 'height_cm', 'settings']);

// Columns intentionally never exported. Global: regenerated timestamps + the tenant pointer
// (re-pointed at the importing user). Per-table: the app_user identity/credentials.
const GLOBAL_EXCLUDE = new Set(['updated_at', 'owner_id', 'user_id']);
const PER_TABLE_EXCLUDE: Record<string, Set<string>> = {
  app_user: new Set(['id', 'username', 'password_hash', 'created_at']),
};

/** Field names of an envelope array's element schema (the columns it serialises). */
function envelopeColumns(arrayKey: string): Set<string> {
  const shape = DataExportEnvelopeSchema.shape as Record<string, z.ZodTypeAny>;
  const arr = shape[arrayKey] as z.ZodArray<z.ZodObject<z.ZodRawShape>> | undefined;
  if (!arr) return new Set();
  return new Set(Object.keys(arr.element.shape));
}

function exportedColumns(table: string): Set<string> {
  if (table === 'app_user') return APP_USER_EXPORTED;
  const key = TABLE_TO_ENVELOPE[table];
  return key ? envelopeColumns(key) : new Set();
}

describe('export/import envelope coverage (anti-omission guard)', () => {
  it('every Prisma scalar column is exported or explicitly whitelisted', () => {
    const violations: string[] = [];

    for (const model of Prisma.dmmf.datamodel.models) {
      const table = model.dbName ?? model.name;

      // A brand-new table must be wired into the envelope (or consciously handled here).
      if (table !== 'app_user' && !(table in TABLE_TO_ENVELOPE)) {
        violations.push(`table "${table}" is not mapped into the export envelope`);
        continue;
      }

      const exported = exportedColumns(table);
      const perTableExclude = PER_TABLE_EXCLUDE[table] ?? new Set<string>();

      for (const field of model.fields) {
        if (field.kind !== 'scalar') continue;
        const column = field.dbName ?? field.name;
        if (GLOBAL_EXCLUDE.has(column) || perTableExclude.has(column)) continue;
        if (!exported.has(column)) {
          violations.push(
            `column "${table}.${column}" is in the schema but not in the export envelope ` +
              `(add it to DataExportEnvelopeSchema + export.ts + data-import.repo.ts, or whitelist it here)`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
