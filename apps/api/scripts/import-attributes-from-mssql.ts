/**
 * Imports legacy attributes + attribute values into the new Attribute /
 * AttributeOption tables. Idempotent (upserts by name and (attributeId, value)).
 *
 * Source mapping (confirmed via probe):
 *   tbl_Config_AttributeMst.AttributeType:
 *     textbox  → text
 *     dropdown → single_select
 *     checkbox → multi_select  (1 row in source — confirm post-import)
 *
 * Notes:
 *   - AttributeMst.ClientId is dropped (target attributes are global, same as
 *     categories). Two source rows with the same trimmed name merge into one
 *     target Attribute; both source AttributeIds map to the same UUID so
 *     their values still attach to the right parent.
 *   - AttributeMst.Description (text) is preserved. Sequence → position.
 *   - Attribute.unit is left null (no source column).
 *   - Inactive attributes are imported (no status field in target).
 */

import './_shared/load-env';
import { PrismaClient, AttributeType } from '@prisma/client';
import sql from 'mssql';
import { buildMssqlConfig } from './_shared/mssql';

type SourceAttribute = {
  AttributeId: number;
  AttributeType: string | null;
  AttributeName: string;
  Description: string | null;
  Sequence: number;
};

type SourceValue = {
  ValueId: number;
  AttributeId: number;
  Value: string;
  Sequence: number;
};

const TYPE_MAP: Record<string, AttributeType> = {
  textbox: 'text',
  dropdown: 'single_select',
  checkbox: 'multi_select',
};

function mapType(raw: string | null): AttributeType | null {
  if (!raw) return null;
  return TYPE_MAP[raw.trim().toLowerCase()] ?? null;
}

async function main() {
  const prisma = new PrismaClient();
  const pool = await sql.connect(buildMssqlConfig() as sql.config);

  try {
    const attrs = (
      await pool.request().query<SourceAttribute>(`
        SELECT AttributeId, AttributeType, AttributeName, Description, Sequence
        FROM tbl_Config_AttributeMst
        WHERE AttributeName IS NOT NULL
          AND LTRIM(RTRIM(AttributeName)) <> ''
      `)
    ).recordset;

    const values = (
      await pool.request().query<SourceValue>(`
        SELECT ValueId, AttributeId, Value, Sequence
        FROM tbl_Config_AttributeValue
        WHERE Value IS NOT NULL
          AND LTRIM(RTRIM(Value)) <> ''
      `)
    ).recordset;

    console.log(`source: ${attrs.length} attributes, ${values.length} values`);

    // sourceAttributeId → postgres Attribute.id
    const idMap = new Map<number, string>();
    let attrCreated = 0;
    let attrExisting = 0;
    let attrSkippedType = 0;

    for (const a of attrs) {
      const name = a.AttributeName.trim();
      const type = mapType(a.AttributeType);
      if (!type) {
        console.warn(
          `skip attribute "${name}" (AttributeId=${a.AttributeId}): unknown type ${JSON.stringify(a.AttributeType)}`,
        );
        attrSkippedType += 1;
        continue;
      }

      const existing = await prisma.attribute.findUnique({ where: { name } });
      if (existing) {
        idMap.set(a.AttributeId, existing.id);
        attrExisting += 1;
      } else {
        const created = await prisma.attribute.create({
          data: {
            name,
            type,
            description: a.Description?.trim() || null,
            position: a.Sequence ?? 0,
          },
        });
        idMap.set(a.AttributeId, created.id);
        attrCreated += 1;
      }
    }

    let valCreated = 0;
    let valExisting = 0;
    let valOrphan = 0;

    for (const v of values) {
      const value = v.Value.trim();
      const attributeId = idMap.get(v.AttributeId);
      if (!attributeId) {
        console.warn(
          `skip value "${value}" (ValueId=${v.ValueId}): parent AttributeId=${v.AttributeId} not in target`,
        );
        valOrphan += 1;
        continue;
      }
      const existing = await prisma.attributeOption.findUnique({
        where: { attributeId_value: { attributeId, value } },
      });
      if (existing) {
        valExisting += 1;
      } else {
        await prisma.attributeOption.create({
          data: { attributeId, value, position: v.Sequence ?? 0 },
        });
        valCreated += 1;
      }
    }

    console.log(
      `attributes: ${attrCreated} created, ${attrExisting} already existed, ${attrSkippedType} skipped (unknown type)`,
    );
    console.log(
      `values: ${valCreated} created, ${valExisting} already existed, ${valOrphan} skipped (orphan)`,
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
