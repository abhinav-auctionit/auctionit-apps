/**
 * Imports tbl_Config_User (6583 rows) into the new User table.
 *
 * Decisions (probe-confirmed):
 *   - Role precedence (multi-bit users):
 *       IsAdmin / IsAdminAccount / IsSubAdmin  → admin
 *       IsClient / IsClientWithLimit            → client
 *       IsBidder                                 → bidder
 *       IsServiceProvider (alone, no other bit) → SKIP (22 rows)
 *       Nothing set                              → SKIP
 *   - Email handling:
 *       NULL / blank → synthesize legacy<UserId>@noemail.local (18 rows)
 *       Duplicates → newest CreateDatetime wins; older UserIds get merged.
 *         Merged UserIds still map to the survivor's UUID in the id-map so
 *         FK references from other tables (BidderProfile.userId, CreatedBy,
 *         etc.) resolve correctly. Merge map written to .tmp/merged-users.csv.
 *   - Email is normalised to lowercase for dedup AND storage. Postgres
 *     varchar is case-sensitive; without normalisation "Foo@x.com" and
 *     "foo@x.com" would coexist and break login lookups.
 *   - Password: source values are 32-char MD5 hex (probe-confirmed).
 *     Imported with passwordHashAlgo='md5'; the existing login path
 *     lazy-rehashes to argon2 on first successful login.
 *   - Phone: rough parse. "+919876543210" → country=+91, number=9876543210.
 *     10-digit value → defaults to +91. Anything else → mobileNumber raw,
 *     country null. Multi-number strings ("9876543210/9123456789") imported
 *     as-is into mobileNumber for human review later.
 *
 * Output:
 *   .tmp/id-maps/users.json     — source UserId → target User UUID
 *   .tmp/merged-users.csv       — duplicate email merges, for audit
 *   .tmp/skipped-users.csv      — users not imported (role + reason)
 */

import './_shared/load-env';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaClient, UserRole } from '@prisma/client';
import sql from 'mssql';
import { buildMssqlConfig } from './_shared/mssql';
import { saveIdMap } from './_shared/id-map';

type SourceUser = {
  UserId: number;
  UserLoginName: string;
  Password: string;
  Name: string;
  EmailId: string | null;
  PhoneNumber: string | null;
  IsAdmin: boolean;
  IsAdminAccount: boolean;
  IsSubAdmin: boolean | null;
  IsClient: boolean;
  IsClientWithLimit: boolean;
  IsBidder: boolean;
  IsServiceProvider: boolean;
  IsActive: boolean;
  CreateDatetime: Date;
};

const REPO_ROOT = resolve(__dirname, '..', '..', '..');

function pickRole(u: SourceUser): UserRole | null {
  if (u.IsAdmin || u.IsAdminAccount || u.IsSubAdmin) return 'admin';
  if (u.IsClient || u.IsClientWithLimit) return 'client';
  if (u.IsBidder) return 'bidder';
  return null;
}

function normaliseEmail(raw: string | null, userId: number): string {
  const trimmed = raw?.trim() ?? '';
  if (trimmed.length === 0 || !trimmed.includes('@')) {
    return `legacy${userId}@noemail.local`;
  }
  return trimmed.toLowerCase();
}

function parsePhone(raw: string | null): {
  countryCode: string | null;
  number: string | null;
} {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return { countryCode: null, number: null };
  if (trimmed.startsWith('+')) {
    // crude: take the leading + plus the next 1-3 digits as country code
    const m = trimmed.match(/^(\+\d{1,3})(.*)$/);
    if (m) {
      return { countryCode: m[1], number: m[2].replace(/\s+/g, '').slice(0, 20) || null };
    }
  }
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 10) {
    return { countryCode: '+91', number: digits };
  }
  return { countryCode: null, number: trimmed.slice(0, 20) };
}

async function writeCsv(path: string, header: string[], rows: string[][]) {
  const escape = (s: string) =>
    /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [header, ...rows].map((r) => r.map(escape).join(','));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, lines.join('\n'), 'utf-8');
}

async function main() {
  const prisma = new PrismaClient();
  const pool = await sql.connect(buildMssqlConfig() as sql.config);

  try {
    const rows = (
      await pool.request().query<SourceUser>(`
        SELECT UserId, UserLoginName, Password, Name, EmailId, PhoneNumber,
               IsAdmin, IsAdminAccount, IsSubAdmin, IsClient, IsClientWithLimit,
               IsBidder, IsServiceProvider, IsActive, CreateDatetime
        FROM tbl_Config_User
        ORDER BY UserId ASC
      `)
    ).recordset;

    console.log(`source: ${rows.length} users`);

    // Step 1: filter by role + collect skipped reasons
    const eligible: Array<SourceUser & { role: UserRole; email: string }> = [];
    const skipped: Array<{ userId: number; reason: string }> = [];

    for (const u of rows) {
      const role = pickRole(u);
      if (!role) {
        const reason = u.IsServiceProvider
          ? 'service-provider only'
          : 'no role bits set';
        skipped.push({ userId: u.UserId, reason });
        continue;
      }
      eligible.push({ ...u, role, email: normaliseEmail(u.EmailId, u.UserId) });
    }

    // Step 2: group by email and merge dupes (latest CreateDatetime wins)
    const byEmail = new Map<string, typeof eligible>();
    for (const u of eligible) {
      if (!byEmail.has(u.email)) byEmail.set(u.email, []);
      byEmail.get(u.email)!.push(u);
    }

    const survivors: typeof eligible = [];
    const mergeMap: Array<{
      mergedUserId: number;
      mergedEmail: string;
      mergedCreated: Date;
      survivorUserId: number;
      survivorEmail: string;
    }> = [];

    for (const [, group] of byEmail) {
      group.sort((a, b) => b.CreateDatetime.getTime() - a.CreateDatetime.getTime());
      const [survivor, ...losers] = group;
      survivors.push(survivor);
      for (const l of losers) {
        mergeMap.push({
          mergedUserId: l.UserId,
          mergedEmail: l.EmailId ?? '',
          mergedCreated: l.CreateDatetime,
          survivorUserId: survivor.UserId,
          survivorEmail: survivor.email,
        });
      }
    }

    // Step 2.5: dedup phones. (mobileCountryCode, mobileNumber) is @@unique
    // in the target. Source has dupes (test accounts on shared numbers, etc.).
    // First user by UserId order keeps the phone; rest get null. Logged to
    // .tmp/dropped-phones.csv. Order is stable thanks to ORDER BY UserId.
    const phoneSeen = new Set<string>();
    const droppedPhones: Array<{
      userId: number;
      email: string;
      droppedCountryCode: string;
      droppedNumber: string;
      keptByUserId: number;
    }> = [];
    const phoneByUser = new Map<number, { countryCode: string | null; number: string | null }>();
    const phoneKeptBy = new Map<string, number>();
    for (const u of survivors) {
      const phone = parsePhone(u.PhoneNumber);
      if (phone.countryCode && phone.number) {
        const key = `${phone.countryCode}|${phone.number}`;
        const keeper = phoneKeptBy.get(key);
        if (keeper === undefined) {
          phoneKeptBy.set(key, u.UserId);
          phoneSeen.add(key);
          phoneByUser.set(u.UserId, phone);
        } else {
          droppedPhones.push({
            userId: u.UserId,
            email: u.email,
            droppedCountryCode: phone.countryCode,
            droppedNumber: phone.number,
            keptByUserId: keeper,
          });
          phoneByUser.set(u.UserId, { countryCode: null, number: null });
        }
      } else {
        phoneByUser.set(u.UserId, phone);
      }
    }
    void phoneSeen;

    // Step 3: insert survivors. Idempotent via upsert on email.
    const idMap = new Map<number, string>();
    let created = 0;
    let updated = 0;

    for (const u of survivors) {
      const phone = phoneByUser.get(u.UserId) ?? { countryCode: null, number: null };
      const data = {
        email: u.email,
        name: u.Name.trim().slice(0, 255),
        passwordHash: u.Password,
        passwordHashAlgo: 'md5' as const,
        mobileCountryCode: phone.countryCode,
        mobileNumber: phone.number,
        role: u.role,
      };
      try {
        const before = await prisma.user.findUnique({
          where: { email: data.email },
          select: { id: true },
        });
        const upserted = await prisma.user.upsert({
          where: { email: data.email },
          create: data,
          update: data,
        });
        idMap.set(u.UserId, upserted.id);
        if (before) updated += 1;
        else created += 1;
      } catch (err) {
        console.error(
          `failed user UserId=${u.UserId} email=${data.email}: ${(err as Error).message}`,
        );
      }
    }

    // Step 4: extend id-map so merged UserIds resolve to the survivor's UUID.
    for (const m of mergeMap) {
      const survivorUuid = idMap.get(m.survivorUserId);
      if (survivorUuid) idMap.set(m.mergedUserId, survivorUuid);
    }

    // Step 5: write artifacts.
    const mapPath = await saveIdMap('users', idMap);
    const mergedCsv = resolve(REPO_ROOT, '.tmp', 'merged-users.csv');
    const skippedCsv = resolve(REPO_ROOT, '.tmp', 'skipped-users.csv');
    const droppedPhonesCsv = resolve(REPO_ROOT, '.tmp', 'dropped-phones.csv');
    await writeCsv(
      mergedCsv,
      ['mergedUserId', 'mergedEmail', 'mergedCreated', 'survivorUserId', 'survivorEmail'],
      mergeMap.map((m) => [
        String(m.mergedUserId),
        m.mergedEmail,
        m.mergedCreated.toISOString(),
        String(m.survivorUserId),
        m.survivorEmail,
      ]),
    );
    await writeCsv(
      skippedCsv,
      ['userId', 'reason'],
      skipped.map((s) => [String(s.userId), s.reason]),
    );
    await writeCsv(
      droppedPhonesCsv,
      ['userId', 'email', 'droppedCountryCode', 'droppedNumber', 'keptByUserId'],
      droppedPhones.map((d) => [
        String(d.userId),
        d.email,
        d.droppedCountryCode,
        d.droppedNumber,
        String(d.keptByUserId),
      ]),
    );

    console.log(`eligible: ${eligible.length} (${skipped.length} skipped)`);
    console.log(
      `survivors: ${survivors.length} (${mergeMap.length} merged into survivors)`,
    );
    console.log(`phones nulled due to duplicates: ${droppedPhones.length}`);
    console.log(`users: ${created} created, ${updated} updated`);
    console.log(`id-map written: ${mapPath}`);
    console.log(`merge log: ${mergedCsv}`);
    console.log(`skipped log: ${skippedCsv}`);
    console.log(`dropped phones log: ${droppedPhonesCsv}`);
  } finally {
    await pool.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
