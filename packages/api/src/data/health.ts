import { prisma } from './prisma.js';

// DB liveness ping for the health route (proves api → db connectivity).
export async function pingDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
