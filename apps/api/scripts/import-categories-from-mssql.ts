/**
 * One-off importer: pulls categories + subcategories from the legacy MSSQL
 * tables (tbl_Config_ItemCategoryMst / tbl_Config_ItemSubCategoryMst) into the
 * Postgres Category / Subcategory tables. Idempotent — safe to re-run; matches
 * existing rows by name.
 *
 * Connection (pick one):
 *   MSSQL_URL='Server=host,1433;Database=db;User Id=user;Password=pass;Encrypt=true;TrustServerCertificate=true'
 *   ...or set MSSQL_HOST + MSSQL_PORT + MSSQL_DATABASE + MSSQL_USER + MSSQL_PASSWORD individually.
 *
 * Source notes:
 *   - tbl_Config_ItemCategoryMst.CategoryName is nullable; we skip null/empty.
 *   - tbl_Config_ItemCategoryMst.ClientId exists in the source (categories
 *     are per-client there) but the target schema treats Category.name as
 *     globally unique. Two source rows with the same trimmed name therefore
 *     merge into one Postgres category — both source IDs map to the same
 *     UUID, so subcategories from either parent attach correctly.
 *   - IsActive is ignored — every category/subcategory is imported. Filter
 *     in the SELECT below if you only want active rows.
 */

import './_shared/load-env';
import { PrismaClient } from '@prisma/client';
import sql from 'mssql';
import { buildMssqlConfig } from './_shared/mssql';

type SourceCategory = { ItemCategoryId: number; CategoryName: string };
type SourceSubcategory = {
  SubCategoryId: number;
  CategoryId: number;
  SubCategoryName: string;
};

async function main() {
  const prisma = new PrismaClient();
  const pool = await sql.connect(buildMssqlConfig() as sql.config);

  try {
    const cats = (
      await pool.request().query<SourceCategory>(`
        SELECT ItemCategoryId, CategoryName
        FROM tbl_Config_ItemCategoryMst
        WHERE CategoryName IS NOT NULL
          AND LTRIM(RTRIM(CategoryName)) <> ''
      `)
    ).recordset;

    const subs = (
      await pool.request().query<SourceSubcategory>(`
        SELECT SubCategoryId, CategoryId, SubCategoryName
        FROM tbl_Config_ItemSubCategoryMst
        WHERE SubCategoryName IS NOT NULL
          AND LTRIM(RTRIM(SubCategoryName)) <> ''
      `)
    ).recordset;

    console.log(`source: ${cats.length} categories, ${subs.length} subcategories`);

    // sourceCategoryId → postgres Category.id
    const idMap = new Map<number, string>();
    let catCreated = 0;
    let catExisting = 0;

    for (const c of cats) {
      const name = c.CategoryName.trim();
      const existing = await prisma.category.findUnique({ where: { name } });
      if (existing) {
        idMap.set(c.ItemCategoryId, existing.id);
        catExisting += 1;
      } else {
        const created = await prisma.category.create({ data: { name } });
        idMap.set(c.ItemCategoryId, created.id);
        catCreated += 1;
      }
    }

    let subCreated = 0;
    let subExisting = 0;
    let subOrphan = 0;

    for (const s of subs) {
      const name = s.SubCategoryName.trim();
      const categoryId = idMap.get(s.CategoryId);
      if (!categoryId) {
        console.warn(
          `skip subcategory "${name}" (SubCategoryId=${s.SubCategoryId}): parent CategoryId=${s.CategoryId} not in target`,
        );
        subOrphan += 1;
        continue;
      }
      const existing = await prisma.subcategory.findUnique({
        where: { categoryId_name: { categoryId, name } },
      });
      if (existing) {
        subExisting += 1;
      } else {
        await prisma.subcategory.create({ data: { categoryId, name } });
        subCreated += 1;
      }
    }

    console.log(
      `categories: ${catCreated} created, ${catExisting} already existed`,
    );
    console.log(
      `subcategories: ${subCreated} created, ${subExisting} already existed, ${subOrphan} skipped (orphan)`,
    );
  } finally {
    await pool.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
