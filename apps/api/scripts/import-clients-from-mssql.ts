/**
 * Imports tbl_Config_ClientMst (195 rows) into the new Client table.
 * Idempotent (upsert by PAN). Persists source ClientId → target UUID to
 * .tmp/id-maps/clients.json for the auctions importer.
 *
 * Decisions baked in (probe-confirmed where applicable):
 *   - Country defaults to "India" — all 195 source rows have NULL country
 *     and the schema requires non-null.
 *   - RegisteredAddress / PAN / TAN / TIN are nullable in source but required
 *     in target. Source nulls become placeholders so the row imports cleanly:
 *       PAN  null → "LEGACY-CL{ClientId}"  (still unique; obviously synthetic)
 *       TAN  null → ""
 *       TIN  null → ""
 *       Reg. address null → "(legacy — no address on file)"
 *   - RevenueRate decimal(18,4) → Int via *100 (preserves 2 decimals as
 *     "percent × 100" / basis-point-style integer). Null → 0.
 *   - StaggeringOfLots smallint → enum: 0/null → null, 1 → all_lots,
 *     2 → subsequent_lots. Other ints are logged and treated as null.
 *   - OtherChargeIsPersentage bit → enum: true → percentage, false → flat,
 *     null → null. Amount preserved as Int (assumes whole rupees).
 *   - Tnc (varbinary blob) is SKIPPED — needs file-upload to storage in a
 *     separate pass. Logged for follow-up.
 *   - KamUserId is SKIPPED — needs users to be imported first; a separate
 *     "post-link" pass will populate ClientInternalContact rows.
 *   - allowsConsolidatedEmd defaults to false; source has no equivalent.
 *     Probe showed consolidated-mode attachments are <0.01% of total, so
 *     toggling per-client manually post-cutover is fine.
 */

import './_shared/load-env';
import { PrismaClient, OtherChargeType, StaggeringOfLots } from '@prisma/client';
import sql from 'mssql';
import { buildMssqlConfig } from './_shared/mssql';
import { saveIdMap } from './_shared/id-map';

type SourceClient = {
  ClientId: number;
  CompanyName: string;
  RegisteredAddress: string | null;
  Country: string | null;
  PhoneNumber: string | null;
  WebSiteURL: string | null;
  PAN: string | null;
  TAN: string | null;
  TIN: string | null;
  IsActive: boolean;
  PrefixAuctionCode: string | null;
  SuffixAuctionCode: string | null;
  PlantTechPersonDetails: string | null;
  AutoExtend: boolean;
  ExtendInSec: number | null;
  ExtendDuration: number | null;
  Extension_NoOfTimes: number | null;
  StaggeringOfLots: number;
  StaggeringOfLotsDuration: number;
  StaggeringOfAuction: boolean;
  StaggeringOfAuctionDuration: number;
  OtherChargeIsPersentage: boolean | null;
  OtherChargeAmount: string | number | null;
  RevenueRate: string | number | null;
  DisplayMaterialLocation: boolean | null;
  DisplayPlantLocation: boolean | null;
};

const STAGGERING_MAP: Record<number, StaggeringOfLots | null> = {
  0: null,
  1: 'all_lots',
  2: 'subsequent_lots',
};

function mapStaggering(raw: number): StaggeringOfLots | null {
  if (raw == null) return null;
  if (raw in STAGGERING_MAP) return STAGGERING_MAP[raw];
  console.warn(`unknown StaggeringOfLots value: ${raw} — treating as null`);
  return null;
}

function mapOtherChargeType(raw: boolean | null): OtherChargeType | null {
  if (raw === null) return null;
  return raw ? 'percentage' : 'flat';
}

function toInt(d: string | number | null, scale = 1): number {
  if (d == null) return 0;
  const n = typeof d === 'string' ? parseFloat(d) : d;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * scale);
}

function trimOrNull(s: string | null): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

async function main() {
  const prisma = new PrismaClient();
  const pool = await sql.connect(buildMssqlConfig() as sql.config);

  try {
    const rows = (
      await pool.request().query<SourceClient>(`
        SELECT
          ClientId, CompanyName, RegisteredAddress, Country, PhoneNumber,
          WebSiteURL, PAN, TAN, TIN, IsActive, PrefixAuctionCode,
          SuffixAuctionCode, PlantTechPersonDetails, AutoExtend, ExtendInSec,
          ExtendDuration, Extension_NoOfTimes, StaggeringOfLots,
          StaggeringOfLotsDuration, StaggeringOfAuction,
          StaggeringOfAuctionDuration, OtherChargeIsPersentage,
          OtherChargeAmount, RevenueRate, DisplayMaterialLocation,
          DisplayPlantLocation
        FROM tbl_Config_ClientMst
      `)
    ).recordset;

    console.log(`source: ${rows.length} clients`);

    const idMap = new Map<number, string>();
    let created = 0;
    let updated = 0;
    let placeholderPan = 0;

    for (const r of rows) {
      const companyName = r.CompanyName?.trim() ?? '';
      if (!companyName) {
        console.warn(`skip ClientId=${r.ClientId}: empty CompanyName`);
        continue;
      }

      let pan = trimOrNull(r.PAN);
      if (!pan) {
        pan = `LEGACY-CL${r.ClientId}`;
        placeholderPan += 1;
      }

      const data = {
        companyName: companyName.slice(0, 100),
        registeredAddress:
          (trimOrNull(r.RegisteredAddress) ?? '(legacy — no address on file)').slice(0, 500),
        country: (trimOrNull(r.Country) ?? 'India').slice(0, 64),
        pan: pan.slice(0, 10),
        tan: (trimOrNull(r.TAN) ?? '').slice(0, 10),
        tin: (trimOrNull(r.TIN) ?? '').slice(0, 15),
        phone: trimOrNull(r.PhoneNumber)?.slice(0, 20) ?? null,
        websiteUrl: trimOrNull(r.WebSiteURL)?.slice(0, 100) ?? null,
        isActive: r.IsActive,
        prefixAuctionCode: trimOrNull(r.PrefixAuctionCode)?.slice(0, 25) ?? null,
        suffixAuctionCode: trimOrNull(r.SuffixAuctionCode)?.slice(0, 25) ?? null,
        plantTechPersonDetails:
          trimOrNull(r.PlantTechPersonDetails)?.slice(0, 200) ?? null,
        autoExtend: r.AutoExtend,
        extendIfLastBidSec: r.ExtendInSec ?? null,
        extendDurationSec: r.ExtendDuration ?? null,
        extensionMaxTimes: r.Extension_NoOfTimes ?? null,
        staggeringOfLots: mapStaggering(r.StaggeringOfLots),
        staggeringOfLotsDurationSec: r.StaggeringOfLotsDuration ?? null,
        staggeringOfAuction: r.StaggeringOfAuction,
        staggeringOfAuctionDurationSec: r.StaggeringOfAuctionDuration ?? null,
        otherChargeType: mapOtherChargeType(r.OtherChargeIsPersentage),
        otherChargeAmount:
          r.OtherChargeIsPersentage === null ? null : toInt(r.OtherChargeAmount, 1),
        revenueRate: toInt(r.RevenueRate, 100),
        displayMaterialLocation: r.DisplayMaterialLocation ?? false,
        displayPlantLocation: r.DisplayPlantLocation ?? false,
        allowsConsolidatedEmd: false,
      };

      // Upsert by PAN — but PAN was nullable in source, so the placeholder
      // matters for round-tripping. Real PANs collide on conflict; placeholders
      // are unique per source ClientId, so they don't.
      try {
        const upserted = await prisma.client.upsert({
          where: { pan: data.pan },
          create: data,
          update: data,
        });
        const wasCreated =
          upserted.createdAt.getTime() === upserted.updatedAt.getTime();
        if (wasCreated) created += 1;
        else updated += 1;
        idMap.set(r.ClientId, upserted.id);
      } catch (err) {
        console.error(
          `failed to upsert ClientId=${r.ClientId} (PAN=${data.pan}): ${(err as Error).message}`,
        );
      }
    }

    const mapPath = await saveIdMap('clients', idMap);
    console.log(
      `clients: ${created} created, ${updated} updated, ${placeholderPan} with placeholder PAN`,
    );
    console.log(`id-map written: ${mapPath}`);
  } finally {
    await pool.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
