import { PrismaClient } from '@prisma/client';

// Single PrismaClient for the process (data/ layer; the only place Prisma lives).
export const prisma = new PrismaClient();
