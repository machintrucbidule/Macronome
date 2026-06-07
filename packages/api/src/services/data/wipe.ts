import { dataWipeRepo } from '../../data/repositories/data-wipe.repo.js';

// Wipe all tracked data, keep the account seed (IMP-1, B-001). Thin orchestration over the
// repository's transactional delete (the destructive confirmation lives in the web layer).

export async function wipeData(userId: string): Promise<void> {
  await dataWipeRepo.wipeContent(userId);
}
