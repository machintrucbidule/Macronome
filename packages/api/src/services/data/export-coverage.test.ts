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
  advice: 'advices',
};

// app_user is projected (not a 1:1 array): its exported columns live in `profile` + `settings`.
const APP_USER_EXPORTED = new Set(['sex', 'birthdate', 'height_cm', 'settings']);

// Whole tables intentionally never exported:
// · account_token (B-193/194) holds transient single-use security artifacts (hashed invite/reset
//   links) — instance-operational, not user data; exporting them would be meaningless and would
//   leak the hashes.
// · day_restore_point (B-261) holds the single pending undo of a destructive day action. It is
//   transient UI recourse, not history: the day it describes no longer exists as such, and the
//   only affordance that can reach it is a toast in the session that created it. Restoring it
//   into another instance would resurrect a state the user had already discarded.
const TABLE_EXCLUDE = new Set(['account_token', 'day_restore_point']);

// Columns intentionally never exported. Global: regenerated timestamps + the tenant pointer
// (re-pointed at the importing user). Per-table: the app_user identity/credentials, plus the
// B-190 account metadata — an import must never change the importer's role or overwrite the
// operational login/activity stamps.
const GLOBAL_EXCLUDE = new Set(['updated_at', 'owner_id', 'user_id']);
const PER_TABLE_EXCLUDE: Record<string, Set<string>> = {
  app_user: new Set([
    'id',
    'username',
    'password_hash',
    'created_at',
    'is_admin',
    'last_login_at',
    'last_seen_at',
  ]),
};

/** Field names of an envelope array's element schema (the columns it serialises). Unwraps any
 *  optional/default wrapper (e.g. `advices: z.array(...).optional().default([])`, B-202) to reach
 *  the array. */
function envelopeColumns(arrayKey: string): Set<string> {
  const shape = DataExportEnvelopeSchema.shape as Record<string, z.ZodTypeAny>;
  let node: z.ZodTypeAny | undefined = shape[arrayKey];
  while (node instanceof z.ZodOptional || node instanceof z.ZodDefault) {
    node = node._def.innerType as z.ZodTypeAny;
  }
  if (!(node instanceof z.ZodArray)) return new Set();
  const element = node.element as z.ZodObject<z.ZodRawShape>;
  return new Set(Object.keys(element.shape));
}

function exportedColumns(table: string): Set<string> {
  if (table === 'app_user') return APP_USER_EXPORTED;
  const key = TABLE_TO_ENVELOPE[table];
  return key ? envelopeColumns(key) : new Set();
}

describe('export/import envelope coverage (anti-omission guard)', () => {
  it('every Prisma scalar column is exported or explicitly whitelisted', () => {
    const violations: string[] = [];

    const models = Prisma.dmmf.datamodel.models.filter(
      (m) => !TABLE_EXCLUDE.has(m.dbName ?? m.name),
    );
    for (const model of models) {
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
