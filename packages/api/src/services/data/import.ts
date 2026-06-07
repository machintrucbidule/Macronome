import { Prisma } from '@prisma/client';
import { DATA_EXPORT_FORMAT_VERSION, ErrorCode, type DataExportEnvelope } from '@macronome/shared';
import { dataImportRepo } from '../../data/repositories/data-import.repo.js';
import { containerRepo } from '../../data/repositories/container.repo.js';
import { ApiError } from '../../http/errors.js';
import { BUILTIN_CONTAINER_NAME, BUILTIN_CONTAINER_TARE_G } from '../defaults.js';

// Import = REPLACE / restore (IMP-1, B-003). The controller has already Zod-validated the
// envelope shape; here we gate the format version, run the transactional replace, and translate
// a referentially-broken (hand-edited) file's FK/unique violation into a clean 422 instead of a
// 500. A defensive ensureBuiltin re-adds the locked "Rien" container should an extract lack it,
// so the leftover flow always has it.

export async function importData(userId: string, env: DataExportEnvelope): Promise<void> {
  if (env.format_version !== DATA_EXPORT_FORMAT_VERSION) {
    throw new ApiError(422, ErrorCode.ImportUnsupportedVersion, {
      format_version: String(env.format_version),
    });
  }

  try {
    await dataImportRepo.replaceAll(userId, env);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      throw new ApiError(422, ErrorCode.ImportInvalidFormat, { db_code: err.code });
    }
    throw err;
  }

  await containerRepo.ensureBuiltin(userId, BUILTIN_CONTAINER_NAME, BUILTIN_CONTAINER_TARE_G);
}
