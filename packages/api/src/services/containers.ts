import type { Container, CreateContainerRequest, UpdateContainerRequest } from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import type { Container as ContainerModel } from '@prisma/client';
import { containerRepo, type ContainerWriteData } from '../data/repositories/container.repo.js';
import { normalize } from '../domain/search/normalize.js';
import { ApiError } from '../http/errors.js';

// Containers service (spec/api §Settings, spec/screens/containers.md). CRUD over the tare
// catalog. The locked built-in "Rien" cannot be edited or deleted (403); any other delete
// is free — leftover history froze the container as a value, holding no live reference
// (DECISIONS Gap 13). A duplicate normalized name → 409 (UNIQUE owner_id,normalized_name).

const num = (d: { toString(): string }): number => Number(d.toString());

function toDto(row: ContainerModel): Container {
  return {
    id: row.id,
    name: row.name,
    empty_weight_g: num(row.emptyWeightG),
    is_builtin: row.isBuiltin,
  };
}

/** The user's container by id, or a 404 (not found / not owned). */
async function owned(userId: string, id: string): Promise<ContainerModel> {
  const row = await containerRepo.findById(userId, id);
  if (!row) throw new ApiError(404, ErrorCode.NotFound);
  return row;
}

async function assertNameFree(userId: string, name: string, excludeId?: string): Promise<string> {
  const normalizedName = normalize(name);
  if (await containerRepo.existsByNormalizedName(userId, normalizedName, excludeId)) {
    throw new ApiError(409, ErrorCode.Conflict, { name: 'duplicate_container' });
  }
  return normalizedName;
}

export async function list(userId: string): Promise<Container[]> {
  return (await containerRepo.list(userId)).map(toDto);
}

export async function create(userId: string, body: CreateContainerRequest): Promise<Container> {
  const normalizedName = await assertNameFree(userId, body.name);
  return toDto(
    await containerRepo.create(userId, {
      name: body.name,
      normalizedName,
      emptyWeightG: body.empty_weight_g,
    }),
  );
}

export async function update(
  userId: string,
  id: string,
  body: UpdateContainerRequest,
): Promise<Container> {
  const row = await owned(userId, id);
  if (row.isBuiltin) throw new ApiError(403, ErrorCode.Forbidden, { container: 'builtin_locked' });
  const data: Partial<ContainerWriteData> = {};
  if (body.name !== undefined) {
    data.name = body.name;
    data.normalizedName = await assertNameFree(userId, body.name, id);
  }
  if (body.empty_weight_g !== undefined) data.emptyWeightG = body.empty_weight_g;
  return toDto(await containerRepo.update(id, data));
}

export async function remove(userId: string, id: string): Promise<void> {
  const row = await owned(userId, id);
  if (row.isBuiltin) throw new ApiError(403, ErrorCode.Forbidden, { container: 'builtin_locked' });
  await containerRepo.delete(id);
}
