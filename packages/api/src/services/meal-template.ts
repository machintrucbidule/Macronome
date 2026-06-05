import type {
  CreateMealTemplateRequest,
  MealTemplateItem,
  PatchMealTemplateRequest,
} from '@macronome/shared';
import type { MealSlotTemplate as MealTemplateModel } from '@prisma/client';
import { mealTemplateRepo } from '../data/repositories/mealTemplate.repo.js';

// Meal-template service (spec/api §Settings). The ordered default day structure; editing it
// never touches already-created days (their meals are independent once seeded). Thin
// orchestration: ordering + tenancy (a null findOwned → 404 at the controller).

function toDto(row: MealTemplateModel): MealTemplateItem {
  return { id: row.id, name: row.name, order_index: row.orderIndex };
}

export async function list(userId: string): Promise<MealTemplateItem[]> {
  return (await mealTemplateRepo.list(userId)).map(toDto);
}

export async function create(
  userId: string,
  body: CreateMealTemplateRequest,
): Promise<MealTemplateItem> {
  const orderIndex = body.order_index ?? (await mealTemplateRepo.nextOrderIndex(userId));
  return toDto(await mealTemplateRepo.create(userId, { name: body.name, orderIndex }));
}

export async function update(
  userId: string,
  id: string,
  body: PatchMealTemplateRequest,
): Promise<MealTemplateItem | null> {
  if (!(await mealTemplateRepo.findOwned(userId, id))) return null;
  return toDto(
    await mealTemplateRepo.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.order_index !== undefined ? { orderIndex: body.order_index } : {}),
    }),
  );
}

export async function remove(userId: string, id: string): Promise<boolean> {
  if (!(await mealTemplateRepo.findOwned(userId, id))) return false;
  await mealTemplateRepo.delete(id);
  return true;
}
