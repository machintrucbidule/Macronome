import type { LeftoverGroup, LeftoverRequest, PatchLeftoverRequest } from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import { containerRepo } from '../data/repositories/container.repo.js';
import { dayRepo } from '../data/repositories/day.repo.js';
import { entryRepo } from '../data/repositories/entry.repo.js';
import { leftoverRepo, type LeftoverWriteData } from '../data/repositories/leftover.repo.js';
import { netLeftover, validate } from '../domain/leftover/index.js';
import { ApiError } from '../http/errors.js';

// Leftover service (spec/api/days-meals-leftover.md §Leftover). It freezes the chosen
// container as a value (name + tare), totals the selected served grams, then BLOCKS with
// a 409 — writing NOTHING — when the net is negative or exceeds what was served
// (RECONCILIATION_LOG §E1). Proration of consumed values is derived on read; this layer
// only persists the group + its selected subset. Ownership: meal/group → day_log.user_id.

const num = (d: { toString(): string }): number => Number(d.toString());

interface FrozenContainer {
  name: string;
  tare: number;
}

/** Resolve the container to its frozen value. null = built-in "Rien" (tare 0). */
async function resolveContainer(
  userId: string,
  containerId: string | null,
): Promise<FrozenContainer> {
  if (containerId === null) return { name: 'Rien', tare: 0 };
  const container = await containerRepo.findById(userId, containerId);
  if (!container) throw new ApiError(404, ErrorCode.NotFound);
  return { name: container.name, tare: num(container.emptyWeightG) };
}

/** Total served grams over the selected eligible lines (422 on a bad/weightless line). */
async function selectionServedTotal(mealId: string, entryIds: string[]): Promise<number> {
  const entries = await entryRepo.entriesByIds(mealId, entryIds);
  if (entries.length !== entryIds.length) {
    throw new ApiError(422, ErrorCode.ValidationError, { entry_ids: 'invalid_selection' });
  }
  let total = 0;
  for (const e of entries) {
    if (e.servedGrams === null) {
      throw new ApiError(422, ErrorCode.ValidationError, { entry_ids: 'weightless_line' });
    }
    total += num(e.servedGrams);
  }
  return total;
}

/** Validate the net leftover or throw the contract's 409 (nothing written on a block). */
function assertValid(net: number, servedTotal: number): void {
  const result = validate(net, servedTotal);
  if (!result.ok) throw new ApiError(409, result.code);
}

function toDto(
  group: {
    id: string;
    containerName: string;
    tareG: { toString(): string };
    grossGrams: { toString(): string };
  },
  net: number,
  entryIds: string[],
): LeftoverGroup {
  return {
    id: group.id,
    container_name: group.containerName,
    tare_g: num(group.tareG),
    gross_grams: num(group.grossGrams),
    leftover_net_grams: net,
    entry_ids: entryIds,
  };
}

export async function create(
  userId: string,
  mealId: string,
  body: LeftoverRequest,
): Promise<LeftoverGroup | null> {
  if (!(await dayRepo.ownedMeal(userId, mealId))) return null;
  const container = await resolveContainer(userId, body.container_id);
  const servedTotal = await selectionServedTotal(mealId, body.entry_ids);
  const net = netLeftover(body.gross_grams, container.tare);
  assertValid(net, servedTotal);
  const data: LeftoverWriteData = {
    containerName: container.name,
    tareG: container.tare,
    grossGrams: body.gross_grams,
    entryIds: body.entry_ids,
  };
  return toDto(await leftoverRepo.create(mealId, data), net, body.entry_ids);
}

export async function update(
  userId: string,
  groupId: string,
  body: PatchLeftoverRequest,
): Promise<LeftoverGroup | null> {
  const group = await leftoverRepo.ownedGroup(userId, groupId);
  if (!group) return null;
  const container =
    body.container_id !== undefined
      ? await resolveContainer(userId, body.container_id)
      : { name: group.containerName, tare: num(group.tareG) };
  const grossGrams = body.gross_grams ?? num(group.grossGrams);
  const entryIds = body.entry_ids ?? (await leftoverRepo.entryIdsOf(groupId));
  const servedTotal = await selectionServedTotal(group.mealId, entryIds);
  const net = netLeftover(grossGrams, container.tare);
  assertValid(net, servedTotal);
  const data: LeftoverWriteData = {
    containerName: container.name,
    tareG: container.tare,
    grossGrams,
    entryIds,
  };
  return toDto(await leftoverRepo.update(groupId, data), net, entryIds);
}

export function remove(userId: string, groupId: string): Promise<boolean> {
  return leftoverRepo.delete(userId, groupId);
}
