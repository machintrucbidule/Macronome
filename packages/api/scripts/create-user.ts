import argon2 from 'argon2';
import { prisma } from '../src/data/prisma.js';
import { seedDefaultsForUser } from '../src/services/user-bootstrap.js';

// One-off bootstrap of the single v1 user (no public sign-up — ops.md §7).
// Usage: npm run create-user -w @macronome/api -- \
//   --username u --password p --sex male --birthdate 1990-01-01 --height 180
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (key && value !== undefined) args[key] = value;
  }
  return args;
}

async function main(): Promise<void> {
  const a = parseArgs();
  const required = ['username', 'password', 'sex', 'birthdate', 'height'];
  const missing = required.filter((k) => !a[k]);
  if (missing.length) {
    throw new Error(`Missing required args: ${missing.join(', ')}`);
  }

  const passwordHash = await argon2.hash(a.password!, { type: argon2.argon2id });
  const user = await prisma.appUser.create({
    data: {
      username: a.username!.toLowerCase(),
      passwordHash,
      sex: a.sex!,
      birthdate: new Date(a.birthdate!),
      heightCm: Number(a.height),
    },
    select: { id: true, username: true },
  });
  await seedDefaultsForUser(user.id); // default meal template + locked built-in "Rien"
  console.log(`Created user ${user.username} (${user.id}).`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
