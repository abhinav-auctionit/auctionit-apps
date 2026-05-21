/**
 * Runs a battery of distinct-value / cross-tab queries against the legacy
 * MSSQL DB to surface every value the wave-1 importers would otherwise have
 * to guess at. Read-only — safe to run anytime.
 *
 * Output: .tmp/probe.txt (sectioned, one probe per section). Read the file,
 * confirm the mapping decisions baked into each importer, then write the
 * importers with hardcoded mappings instead of guesses.
 *
 * Connection: same env vars as dump-mssql-schema.ts / import-categories-from-mssql.ts.
 */

import './_shared/load-env';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sql from 'mssql';
import { buildMssqlConfig } from './_shared/mssql';

type Probe = { title: string; query: string; note?: string };

const PROBES: Probe[] = [
  {
    title: 'tbl_Data_Auction.AuctionType distinct values',
    note: 'Maps to AuctionType enum (forward/reverse/sealed_bid/yankee). Look for typos, whitespace, case variants.',
    query: `
      SELECT ISNULL(AuctionType, '<NULL>') AS value, COUNT(*) AS cnt
      FROM tbl_Data_Auction
      GROUP BY AuctionType
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Data_Auction status flag cross-tab',
    note: 'Drives the bit→enum mapping. Each row = a combination that actually exists in the data.',
    query: `
      SELECT IsApproved, IsPublished, IsClosed, IsCanceled, IsDeleted, IsArchived, IsActive,
             COUNT(*) AS cnt
      FROM tbl_Data_Auction
      GROUP BY IsApproved, IsPublished, IsClosed, IsCanceled, IsDeleted, IsArchived, IsActive
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Data_AuctionLot.UOM distinct values',
    note: 'Free-text in source; target enum is MT/KG/NOS/PCS/LTR/BAG/CUM/BOX. Anything else needs a mapping rule or "skip".',
    query: `
      SELECT ISNULL(UOM, '<NULL>') AS value, COUNT(*) AS cnt
      FROM tbl_Data_AuctionLot
      GROUP BY UOM
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Data_AuctionLot.Status distinct values',
    note: 'tinyint with unknown semantics. We need to know what each value means.',
    query: `
      SELECT ISNULL(Status, -1) AS value, COUNT(*) AS cnt
      FROM tbl_Data_AuctionLot
      GROUP BY Status
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Data_AuctionLot.IsReverseAuction vs auction-level type',
    note: 'Detects lots that override the auction-level type.',
    query: `
      SELECT a.AuctionType AS auctionLevel, l.IsReverseAuction AS lotLevel,
             COUNT(*) AS cnt
      FROM tbl_Data_AuctionLot l
      JOIN tbl_Data_Auction a ON l.AuctionId = a.AuctionId
      GROUP BY a.AuctionType, l.IsReverseAuction
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Config_User role bit overlap',
    note: 'A user with multiple bits set needs a precedence rule. Look for non-trivial combinations.',
    query: `
      SELECT IsAdmin, IsAdminAccount, IsSubAdmin, IsClient, IsClientWithLimit,
             IsBidder, IsServiceProvider, IsActive,
             COUNT(*) AS cnt
      FROM tbl_Config_User
      GROUP BY IsAdmin, IsAdminAccount, IsSubAdmin, IsClient, IsClientWithLimit,
               IsBidder, IsServiceProvider, IsActive
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Config_User.Password length distribution',
    note: 'Identifies the hash format. 32 chars = MD5 hex, 60 = bcrypt, 95+ = argon2-encoded, etc. NOT printing values.',
    query: `
      SELECT LEN(Password) AS pwd_length, COUNT(*) AS cnt
      FROM tbl_Config_User
      WHERE Password IS NOT NULL
      GROUP BY LEN(Password)
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Config_BidderCompUser multi-company users',
    note: 'How many users link to >1 bidder company. M:N mismatch with new 1:1 BidderProfile.',
    query: `
      SELECT n_companies, COUNT(*) AS n_users
      FROM (
        SELECT UserId, COUNT(*) AS n_companies
        FROM tbl_Config_BidderCompUser
        GROUP BY UserId
      ) t
      GROUP BY n_companies
      ORDER BY n_companies;
    `,
  },
  {
    title: 'tbl_Config_BidderCompanyMst status combinations',
    note: 'For mapping to BidderStatus (draft/pending_approval/approved/rejected).',
    query: `
      SELECT Approved, IsActive, IsBlocked, COUNT(*) AS cnt
      FROM tbl_Config_BidderCompanyMst
      GROUP BY Approved, IsActive, IsBlocked
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Config_AttributeMst.AttributeType distinct values',
    note: 'Maps to AttributeType enum (text/number/single_select/multi_select).',
    query: `
      SELECT ISNULL(AttributeType, '<NULL>') AS value, COUNT(*) AS cnt
      FROM tbl_Config_AttributeMst
      GROUP BY AttributeType
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Config_ClientMst country distribution',
    note: 'Whether to import Country as-is or normalise (some apps have IN/India/INDIA/etc.).',
    query: `
      SELECT ISNULL(Country, '<NULL>') AS country, COUNT(*) AS cnt
      FROM tbl_Config_ClientMst
      GROUP BY Country
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Config_BidderCompanyMst country distribution',
    note: 'Same as above but for bidders. Likely much messier.',
    query: `
      SELECT ISNULL(Country, '<NULL>') AS country, COUNT(*) AS cnt
      FROM tbl_Config_BidderCompanyMst
      GROUP BY Country
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Data_Auction_BidderComp_Map: lot-level vs auction-level split',
    note: 'LotId NULL = consolidated/auction-level attachment, LotId NOT NULL = lot-level. Drives the LotParticipation vs AuctionParticipation split.',
    query: `
      SELECT
        CASE WHEN LotId IS NULL THEN 'auction-level (LotId NULL)' ELSE 'lot-level' END AS kind,
        IsActive,
        ISNULL(IsEMDWithClient, '<NULL>') AS isEmdWithClient,
        COUNT(*) AS cnt
      FROM tbl_Data_Auction_BidderComp_Map
      GROUP BY CASE WHEN LotId IS NULL THEN 'auction-level (LotId NULL)' ELSE 'lot-level' END,
               IsActive, IsEMDWithClient
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Data_BidderPassBook.EMDProcessStatus distinct values',
    note: 'Maps to WalletTxnKind enum (admin_credit, emd_hold, emd_release, emd_forfeit, etc.). Need to know what each int means.',
    query: `
      SELECT ISNULL(EMDProcessStatus, -1) AS status,
             COUNT(*) AS cnt,
             SUM(AmountCR) AS sum_cr,
             SUM(AmountDR) AS sum_dr
      FROM tbl_Data_BidderPassBook
      GROUP BY EMDProcessStatus
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Data_EMDReserved.EMDStatus + EmdBlockStatus distribution',
    note: 'Drives whether each EMD reservation is currently held, released, forfeited.',
    query: `
      SELECT ISNULL(EMDStatus, -1) AS emdStatus,
             ISNULL(EmdBlockStatus, '<NULL>') AS emdBlockStatus,
             ISNULL(IsRefund, 0) AS isRefund,
             COUNT(*) AS cnt
      FROM tbl_Data_EMDReserved
      GROUP BY EMDStatus, EmdBlockStatus, IsRefund
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Config_Item_UOM lookup table contents',
    note: 'The "official" UOM list. Cross-reference with the actual UOM values used on lots.',
    query: `SELECT Id, UOMText FROM tbl_Config_Item_UOM ORDER BY Id;`,
  },
  {
    title: 'tbl_Data_AuctionLot outcome flags',
    note: 'LeftedDate (lifted), other outcome columns. Lot outcome status reconstruction.',
    query: `
      SELECT
        CASE WHEN WinnerUserId IS NULL THEN 'no winner' ELSE 'has winner' END AS winner,
        CASE WHEN LeftedDate IS NULL THEN 'not lifted' ELSE 'lifted' END AS lifted,
        IsActive,
        COUNT(*) AS cnt
      FROM tbl_Data_AuctionLot
      GROUP BY
        CASE WHEN WinnerUserId IS NULL THEN 'no winner' ELSE 'has winner' END,
        CASE WHEN LeftedDate IS NULL THEN 'not lifted' ELSE 'lifted' END,
        IsActive
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'Categories with non-trivial names',
    note: 'Confirms dedup math — same trimmed name across multiple ClientIds.',
    query: `
      SELECT LTRIM(RTRIM(CategoryName)) AS name,
             COUNT(DISTINCT ClientId) AS distinct_clients,
             COUNT(*) AS rows
      FROM tbl_Config_ItemCategoryMst
      WHERE CategoryName IS NOT NULL AND LTRIM(RTRIM(CategoryName)) <> ''
      GROUP BY LTRIM(RTRIM(CategoryName))
      HAVING COUNT(*) > 1
      ORDER BY rows DESC;
    `,
  },
  {
    title: 'tbl_Config_User email vs login name (which is the unique identifier?)',
    note: 'New schema requires unique email. If logins are sometimes phone numbers / non-emails, we have a problem.',
    query: `
      SELECT TOP 20
        CASE
          WHEN EmailId IS NULL OR EmailId = '' THEN 'no email'
          WHEN CHARINDEX('@', EmailId) = 0 THEN 'no @ sign'
          ELSE 'looks like email'
        END AS email_quality,
        COUNT(*) AS cnt
      FROM tbl_Config_User
      GROUP BY
        CASE
          WHEN EmailId IS NULL OR EmailId = '' THEN 'no email'
          WHEN CHARINDEX('@', EmailId) = 0 THEN 'no @ sign'
          ELSE 'looks like email'
        END
      ORDER BY cnt DESC;
    `,
  },
  {
    title: 'tbl_Config_User duplicate email check',
    note: 'New User.email is @unique. If old DB has dupes, importer needs a tie-break rule.',
    query: `
      SELECT TOP 20 EmailId, COUNT(*) AS dupes
      FROM tbl_Config_User
      WHERE EmailId IS NOT NULL AND EmailId <> ''
      GROUP BY EmailId
      HAVING COUNT(*) > 1
      ORDER BY dupes DESC;
    `,
  },
];

async function main() {
  const pool = await sql.connect(buildMssqlConfig() as sql.config);
  try {
    const sections: string[] = [];
    sections.push(`# MSSQL probe — ${new Date().toISOString()}`);
    sections.push(`# Database: ${process.env.MSSQL_DATABASE ?? '(MSSQL_URL)'}`);
    sections.push('');

    for (const probe of PROBES) {
      console.log(`running: ${probe.title}`);
      sections.push('='.repeat(72));
      sections.push(probe.title);
      if (probe.note) sections.push(`# ${probe.note}`);
      sections.push('='.repeat(72));
      try {
        const result = await pool.request().query(probe.query);
        const rows = result.recordset ?? [];
        if (rows.length === 0) {
          sections.push('(no rows)');
        } else {
          const headers = Object.keys(rows[0]);
          const widths = headers.map((h) =>
            Math.max(
              h.length,
              ...rows.map((r) => String(r[h] ?? '').length),
            ),
          );
          const fmt = (vals: unknown[]) =>
            vals.map((v, i) => String(v ?? '').padEnd(widths[i])).join('  ');
          sections.push(fmt(headers));
          sections.push(widths.map((w) => '-'.repeat(w)).join('  '));
          for (const r of rows) sections.push(fmt(headers.map((h) => r[h])));
        }
      } catch (err) {
        sections.push(`!! query failed: ${(err as Error).message}`);
      }
      sections.push('');
    }

    const repoRoot = resolve(__dirname, '..', '..', '..');
    const outPath = resolve(repoRoot, '.tmp', 'probe.txt');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, sections.join('\n'), 'utf-8');
    console.log(`wrote ${outPath}`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
