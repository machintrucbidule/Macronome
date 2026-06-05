import { prisma } from '../../src/data/prisma.js';
import { PERF_USERNAME } from './config.js';

// Surgical teardown of the perf throwaway user and everything it owns. Targeted deletes
// (not TRUNCATE) so a perf run never wipes other data in the test DB. Order respects the
// FK rules: day_log delete cascades meal→meal_entry→leftover_group(_entry); foods can
// only go once their referencing meal_entries are gone; the user goes last (RESTRICT).

/** Resolve the perf user's id, or null when it does not exist yet. */
export async function findPerfUser(): Promise<string | null> {
  const user = await prisma.appUser.findUnique({
    where: { username: PERF_USERNAME },
    select: { id: true },
  });
  return user?.id ?? null;
}

/** Delete the perf user and all of its owned rows. No-op when nothing is seeded. */
export async function cleanupPerfUser(): Promise<void> {
  const userId = await findPerfUser();
  if (!userId) return;
  await prisma.dayLog.deleteMany({ where: { userId } }); // cascades meals/entries/leftovers
  await prisma.food.deleteMany({ where: { ownerId: userId } }); // cascades food_portion
  await prisma.weightEntry.deleteMany({ where: { userId } });
  await prisma.target.deleteMany({ where: { userId } });
  await prisma.pantryItem.deleteMany({ where: { userId } });
  await prisma.mealSlotTemplate.deleteMany({ where: { userId } });
  await prisma.container.deleteMany({ where: { ownerId: userId } });
  await prisma.appUser.delete({ where: { id: userId } });
}
