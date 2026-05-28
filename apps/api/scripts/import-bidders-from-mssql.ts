/**
 * Imports tbl_Config_BidderCompUser × tbl_Config_BidderCompanyMst into the
 * new BidderProfile table.
 *
 * Depends on `import:users` having run — uses .tmp/id-maps/users.json to
 * resolve the legacy UserId to the new User UUID. Rows whose UserId is
 * missing from the id-map are skipped and logged.
 *
 * Decisions (probe-confirmed where applicable):
 *   - Source is M:N (BidderCompUser) but probe shows every user maps to
 *     exactly one BidderCompId, so each row becomes a 1:1 BidderProfile.
 *     When two users share the same company the company columns are
 *     duplicated across both BidderProfile rows — that's fine; the target
 *     schema is per-user anyway.
 *   - Status (probe: IsBlocked is never true in the source data):
 *       Approved=true  → approved   (6020 + 182 rows)
 *       Approved=false → pending_approval
 *       IsBlocked=true → rejected   (defensive branch; not currently exercised)
 *   - registrationFeePaid = (status === 'approved'). Legacy approved bidders
 *     paid their fee out-of-band; mark them paid so admin views match.
 *   - submittedAt = CreateDatetime. approvedAt = UpdateDatetime ?? CreateDatetime
 *     when approved. rejectedAt = UpdateDatetime ?? CreateDatetime when rejected.
 *   - Required-but-missing fields filled from the linked User row:
 *       fullName            ← User.name
 *       contactCountryCode  ← User.mobileCountryCode or +91 default
 *       contactNumber       ← User.mobileNumber or '' (empty allowed for VarChar)
 *       whatsappCountryCode ← same as contact
 *       whatsappNumber      ← same as contact
 *     Source has no separate whatsapp column, so it mirrors contact.
 *   - interestedIn defaults to 'both' — source has no equivalent.
 *   - companyType / businessActivity / designation / signatory fields:
 *     source has no equivalent → null.
 *   - Email: registeredEmail = company EmailID (if present). Login email
 *     was already set on the User row by the user importer.
 *   - Company phone (BidderCompanyMst.PhoneNumber) is captured as
 *     secondaryNumber so the original lookup value survives even when we
 *     overwrite contactNumber with the user's mobile.
 *
 * Output:
 *   .tmp/id-maps/bidder-profiles.json    — BidderCompId → BidderProfile UUID
 *   .tmp/skipped-bidders.csv             — rows not imported (with reason)
 */

import './_shared/load-env';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaClient, BidderStatus } from '@prisma/client';
import sql from 'mssql';
import { buildMssqlConfig } from './_shared/mssql';
import { loadIdMap, saveIdMap } from './_shared/id-map';

type SourceRow = {
  UserId: number;
  BidderCompId: number;
  CompanyName: string;
  RegisteredAddress: string | null;
  Country: string | null;
  State: string | null;
  City: string | null;
  PinCode: string | null;
  PhoneNumber: string | null;
  WebSiteURL: string | null;
  EmailID: string | null;
  PAN: string | null;
  TIN: string | null;
  GST: string | null;
  IsBlocked: boolean;
  IsActive: boolean;
  Approved: boolean;
  CreateDatetime: Date;
  UpdateDatetime: Date | null;
};

const REPO_ROOT = resolve(__dirname, '..', '..', '..');

function trimOrNull(s: string | null, max?: number): string | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  return max ? t.slice(0, max) : t;
}

function pickStatus(r: SourceRow): BidderStatus {
  if (r.IsBlocked) return 'rejected';
  if (r.Approved) return 'approved';
  return 'pending_approval';
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
    const userIdMap = await loadIdMap('users');
    if (userIdMap.size === 0) {
      throw new Error(
        'users id-map is empty — run `pnpm import:users` first',
      );
    }

    const rows = (
      await pool.request().query<SourceRow>(`
        SELECT bu.UserId, c.BidderCompId, c.CompanyName, c.RegisteredAddress,
               c.Country, c.State, c.City, c.PinCode, c.PhoneNumber,
               c.WebSiteURL, c.EmailID, c.PAN, c.TIN, c.GST,
               c.IsBlocked, c.IsActive, c.Approved,
               c.CreateDatetime, c.UpdateDatetime
        FROM tbl_Config_BidderCompUser bu
        JOIN tbl_Config_BidderCompanyMst c ON bu.BidderCompId = c.BidderCompId
        ORDER BY bu.UserId, c.BidderCompId
      `)
    ).recordset;

    console.log(`source: ${rows.length} bidder user-company links`);

    // Step 1: resolve UserId → target User UUID; collect skips.
    type Eligible = SourceRow & { userUuid: string };
    const eligible: Eligible[] = [];
    const skipped: Array<{ userId: number; bidderCompId: number; reason: string }> = [];

    for (const r of rows) {
      const userUuid = userIdMap.get(String(r.UserId));
      if (!userUuid) {
        skipped.push({
          userId: r.UserId,
          bidderCompId: r.BidderCompId,
          reason: 'user not in id-map (skipped / merged)',
        });
        continue;
      }
      eligible.push({ ...r, userUuid });
    }

    // Step 2: de-dup on userUuid. A handful of legacy UserIds were merged
    // by the user importer (dupe emails) and now resolve to the same UUID.
    // Keep the row with the latest CreateDatetime so the most recent
    // company snapshot wins.
    const byUuid = new Map<string, Eligible>();
    for (const e of eligible) {
      const existing = byUuid.get(e.userUuid);
      if (!existing || e.CreateDatetime.getTime() > existing.CreateDatetime.getTime()) {
        byUuid.set(e.userUuid, e);
      } else {
        skipped.push({
          userId: e.UserId,
          bidderCompId: e.BidderCompId,
          reason: `superseded by newer link for same target user (UserId=${existing.UserId})`,
        });
      }
    }
    const survivors = [...byUuid.values()];

    // Step 3: batch-fetch matching User rows so we can fill the required
    // fullName / contact fields from authoritative data.
    const userUuids = survivors.map((s) => s.userUuid);
    const users = await prisma.user.findMany({
      where: { id: { in: userUuids } },
      select: {
        id: true,
        name: true,
        email: true,
        mobileCountryCode: true,
        mobileNumber: true,
      },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    // Step 4: upsert BidderProfile rows.
    const idMap = new Map<number, string>();
    let created = 0;
    let updated = 0;

    for (const r of survivors) {
      const u = userById.get(r.userUuid);
      if (!u) {
        skipped.push({
          userId: r.UserId,
          bidderCompId: r.BidderCompId,
          reason: 'user row missing in target (was in id-map but not in users table)',
        });
        continue;
      }

      const status = pickStatus(r);
      const contactCountryCode = u.mobileCountryCode ?? '+91';
      const contactNumber = u.mobileNumber ?? '';

      const data = {
        userId: r.userUuid,
        interestedIn: 'both' as const,
        fullName: u.name.slice(0, 255),
        contactCountryCode: contactCountryCode.slice(0, 8),
        contactNumber: contactNumber.slice(0, 20),
        whatsappCountryCode: contactCountryCode.slice(0, 8),
        whatsappNumber: contactNumber.slice(0, 20),

        companyName: trimOrNull(r.CompanyName, 255),
        address: trimOrNull(r.RegisteredAddress),
        country: trimOrNull(r.Country, 64),
        state: trimOrNull(r.State, 128),
        city: trimOrNull(r.City, 128),
        pinCode: trimOrNull(r.PinCode, 16),
        secondaryNumber: trimOrNull(r.PhoneNumber, 32),
        registeredEmail: trimOrNull(r.EmailID, 255) ?? u.email,
        pan: trimOrNull(r.PAN, 16),
        gst: trimOrNull(r.GST, 32),
        // tbl_Config_BidderCompanyMst.TIN exists but the new BidderProfile
        // doesn't have a TIN column — drop it (it survives on the source
        // schema dump if anyone needs it back).

        registrationFeePaid: status === 'approved',
        registrationFeePaidAt: status === 'approved' ? r.UpdateDatetime ?? r.CreateDatetime : null,

        status,
        submittedAt: r.CreateDatetime,
        approvedAt:
          status === 'approved' ? r.UpdateDatetime ?? r.CreateDatetime : null,
        rejectedAt:
          status === 'rejected' ? r.UpdateDatetime ?? r.CreateDatetime : null,
      };

      try {
        const before = await prisma.bidderProfile.findUnique({
          where: { userId: r.userUuid },
          select: { id: true },
        });
        const upserted = await prisma.bidderProfile.upsert({
          where: { userId: r.userUuid },
          create: data,
          update: data,
        });
        idMap.set(r.BidderCompId, upserted.id);
        if (before) updated += 1;
        else created += 1;
      } catch (err) {
        skipped.push({
          userId: r.UserId,
          bidderCompId: r.BidderCompId,
          reason: `upsert failed: ${(err as Error).message}`,
        });
      }
    }

    const mapPath = await saveIdMap('bidder-profiles', idMap);
    const skippedCsv = resolve(REPO_ROOT, '.tmp', 'skipped-bidders.csv');
    await writeCsv(
      skippedCsv,
      ['userId', 'bidderCompId', 'reason'],
      skipped.map((s) => [String(s.userId), String(s.bidderCompId), s.reason]),
    );

    console.log(`eligible: ${eligible.length} (${skipped.length} skipped pre-upsert)`);
    console.log(`survivors after dedup: ${survivors.length}`);
    console.log(`bidder profiles: ${created} created, ${updated} updated`);
    console.log(`id-map written: ${mapPath}`);
    console.log(`skipped log: ${skippedCsv}`);
  } finally {
    await pool.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
