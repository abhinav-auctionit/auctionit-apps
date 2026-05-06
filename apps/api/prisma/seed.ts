import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

type AdminSeed = { email: string; name: string; password: string };

const argonOpts = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

function readAdmins(): AdminSeed[] {
  const json = process.env.SEED_ADMINS;
  if (json) {
    const parsed = JSON.parse(json) as AdminSeed[];
    if (!Array.isArray(parsed)) throw new Error('SEED_ADMINS must be a JSON array');
    return parsed;
  }
  return [
    {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@auctionit.ai',
      name: process.env.SEED_ADMIN_NAME ?? 'Auction Admin',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'changeme123',
    },
  ];
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const admins = readAdmins();
    for (const admin of admins) {
      if (admin.password.length < 8) {
        throw new Error(`password for ${admin.email} must be at least 8 chars`);
      }
      const passwordHash = await hash(admin.password, argonOpts);
      const result = await prisma.user.upsert({
        where: { email: admin.email },
        update: { passwordHash, role: 'admin', name: admin.name },
        create: { email: admin.email, name: admin.name, passwordHash, role: 'admin' },
      });
      console.log(`seeded admin: ${result.email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
