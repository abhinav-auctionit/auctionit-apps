import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { hash } from '@node-rs/argon2';
import * as schema from './schema';

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
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema, casing: 'snake_case' });

  const admins = readAdmins();
  for (const admin of admins) {
    if (admin.password.length < 8) {
      throw new Error(`password for ${admin.email} must be at least 8 chars`);
    }

    const passwordHash = await hash(admin.password, argonOpts);
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, admin.email),
    });

    if (existing) {
      await db
        .update(schema.users)
        .set({ passwordHash, role: 'admin', name: admin.name, updatedAt: new Date() })
        .where(eq(schema.users.id, existing.id));
      console.log(`updated admin: ${admin.email}`);
    } else {
      await db.insert(schema.users).values({
        email: admin.email,
        name: admin.name,
        passwordHash,
        role: 'admin',
      });
      console.log(`created admin: ${admin.email}`);
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
