import { containerRepo } from '../data/repositories/container.repo.js';
import { mealTemplateRepo } from '../data/repositories/mealTemplate.repo.js';
import {
  BUILTIN_CONTAINER_NAME,
  BUILTIN_CONTAINER_TARE_G,
  DEFAULT_MEAL_SLOTS,
} from './defaults.js';

// One-time per-user seeding (run on account creation): the default meal_slot_template that
// structures every new day, and the locked built-in "Rien" container (0 g) the leftover
// flow needs. Both seeders are idempotent (skip when already present), so re-running is
// safe — used by the create-user script and the integration test helper.

export async function seedDefaultsForUser(userId: string): Promise<void> {
  await Promise.all([
    mealTemplateRepo.seedDefaults(userId, DEFAULT_MEAL_SLOTS),
    containerRepo.ensureBuiltin(userId, BUILTIN_CONTAINER_NAME, BUILTIN_CONTAINER_TARE_G),
  ]);
}
