/**
 * Reads metadata from sys.* / INFORMATION_SCHEMA in the legacy MSSQL DB and
 * writes a schema reference to .tmp/old_schema.{txt,json}. Intended as a
 * one-shot tool to seed migration planning — re-run anytime the source schema
 * changes.
 *
 * Connection: same env vars as import-categories-from-mssql.ts:
 *   MSSQL_URL='Server=host,1433;Database=db;User Id=u;Password=p;...'
 *   ...or MSSQL_HOST + MSSQL_PORT + MSSQL_DATABASE + MSSQL_USER + MSSQL_PASSWORD
 *   MSSQL_ENCRYPT=false to disable TLS for on-prem boxes without a cert.
 *
 * Outputs (relative to repo root):
 *   .tmp/old_schema.txt   human-readable summary (tables, columns, FKs, indexes, views)
 *   .tmp/old_schema.json  structured data for programmatic use
 */

import './_shared/load-env';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sql from 'mssql';
import { buildMssqlConfig } from './_shared/mssql';

type ColumnRow = {
  schema_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
  max_length: number;
  precision: number;
  scale: number;
  is_nullable: boolean;
  is_identity: boolean;
  column_id: number;
};

type PkRow = {
  schema_name: string;
  table_name: string;
  pk_name: string;
  column_name: string;
  key_ordinal: number;
};

type FkRow = {
  fk_name: string;
  schema_name: string;
  table_name: string;
  column_name: string;
  ref_schema: string;
  ref_table: string;
  ref_column: string;
  ordinal: number;
};

type IndexRow = {
  schema_name: string;
  table_name: string;
  index_name: string;
  type_desc: string;
  is_unique: boolean;
  column_name: string;
  key_ordinal: number;
  is_included_column: boolean;
};

type TableRow = { schema_name: string; table_name: string; row_count: number };

type ViewRow = { schema_name: string; view_name: string; definition: string };

type TableSummary = {
  schema: string;
  name: string;
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    identity: boolean;
    isPk: boolean;
  }>;
  primaryKey: { name: string; columns: string[] } | null;
  foreignKeys: Array<{
    name: string;
    columns: string[];
    refTable: string;
    refColumns: string[];
  }>;
  indexes: Array<{
    name: string;
    type: string;
    unique: boolean;
    columns: string[];
    included: string[];
  }>;
};

function renderType(c: ColumnRow): string {
  const t = c.data_type.toLowerCase();
  if (t === 'varchar' || t === 'char' || t === 'binary' || t === 'varbinary') {
    return c.max_length === -1 ? `${t}(MAX)` : `${t}(${c.max_length})`;
  }
  if (t === 'nvarchar' || t === 'nchar') {
    return c.max_length === -1 ? `${t}(MAX)` : `${t}(${c.max_length / 2})`;
  }
  if (t === 'decimal' || t === 'numeric') {
    return `${t}(${c.precision},${c.scale})`;
  }
  if (t === 'datetime2' || t === 'datetimeoffset' || t === 'time') {
    return `${t}(${c.scale})`;
  }
  return t;
}

async function main() {
  const pool = await sql.connect(buildMssqlConfig() as sql.config);
  try {
    const tables = (
      await pool.request().query<TableRow>(`
        SELECT s.name AS schema_name, t.name AS table_name,
               SUM(p.rows) AS row_count
        FROM sys.tables t
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
        GROUP BY s.name, t.name
        ORDER BY s.name, t.name;
      `)
    ).recordset;

    const columns = (
      await pool.request().query<ColumnRow>(`
        SELECT s.name AS schema_name, t.name AS table_name,
               c.name AS column_name, ty.name AS data_type,
               c.max_length, c.precision, c.scale,
               c.is_nullable, c.is_identity, c.column_id
        FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        ORDER BY s.name, t.name, c.column_id;
      `)
    ).recordset;

    const pks = (
      await pool.request().query<PkRow>(`
        SELECT s.name AS schema_name, t.name AS table_name,
               i.name AS pk_name, c.name AS column_name, ic.key_ordinal
        FROM sys.indexes i
        JOIN sys.tables t ON i.object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE i.is_primary_key = 1
        ORDER BY s.name, t.name, ic.key_ordinal;
      `)
    ).recordset;

    const fks = (
      await pool.request().query<FkRow>(`
        SELECT fk.name AS fk_name,
               s.name AS schema_name, t.name AS table_name, c.name AS column_name,
               rs.name AS ref_schema, rt.name AS ref_table, rc.name AS ref_column,
               fkc.constraint_column_id AS ordinal
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.tables t ON fk.parent_object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = fkc.parent_column_id
        JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
        JOIN sys.schemas rs ON rt.schema_id = rs.schema_id
        JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
        ORDER BY s.name, t.name, fk.name, fkc.constraint_column_id;
      `)
    ).recordset;

    const indexes = (
      await pool.request().query<IndexRow>(`
        SELECT s.name AS schema_name, t.name AS table_name,
               i.name AS index_name, i.type_desc, i.is_unique,
               c.name AS column_name, ic.key_ordinal, ic.is_included_column
        FROM sys.indexes i
        JOIN sys.tables t ON i.object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE i.is_primary_key = 0 AND i.type > 0 AND i.name IS NOT NULL
        ORDER BY s.name, t.name, i.name, ic.is_included_column, ic.key_ordinal;
      `)
    ).recordset;

    const views = (
      await pool.request().query<ViewRow>(`
        SELECT s.name AS schema_name, v.name AS view_name, m.definition
        FROM sys.views v
        JOIN sys.schemas s ON v.schema_id = s.schema_id
        JOIN sys.sql_modules m ON v.object_id = m.object_id
        ORDER BY s.name, v.name;
      `)
    ).recordset;

    // -- Build per-table structured summary -----------------------------------
    const key = (s: string, t: string) => `${s}.${t}`;
    const summary = new Map<string, TableSummary>();
    for (const t of tables) {
      summary.set(key(t.schema_name, t.table_name), {
        schema: t.schema_name,
        name: t.table_name,
        rowCount: Number(t.row_count) || 0,
        columns: [],
        primaryKey: null,
        foreignKeys: [],
        indexes: [],
      });
    }
    const pkColsByTable = new Map<string, Set<string>>();
    for (const r of pks) {
      const k = key(r.schema_name, r.table_name);
      const s = summary.get(k);
      if (!s) continue;
      if (!s.primaryKey) s.primaryKey = { name: r.pk_name, columns: [] };
      s.primaryKey.columns.push(r.column_name);
      if (!pkColsByTable.has(k)) pkColsByTable.set(k, new Set());
      pkColsByTable.get(k)!.add(r.column_name);
    }
    for (const c of columns) {
      const k = key(c.schema_name, c.table_name);
      const s = summary.get(k);
      if (!s) continue;
      s.columns.push({
        name: c.column_name,
        type: renderType(c),
        nullable: c.is_nullable,
        identity: c.is_identity,
        isPk: pkColsByTable.get(k)?.has(c.column_name) ?? false,
      });
    }
    const fkByName = new Map<string, FkRow[]>();
    for (const r of fks) {
      const k = `${r.schema_name}.${r.table_name}::${r.fk_name}`;
      if (!fkByName.has(k)) fkByName.set(k, []);
      fkByName.get(k)!.push(r);
    }
    for (const [k, rows] of fkByName) {
      const ownerKey = k.split('::')[0];
      const s = summary.get(ownerKey);
      if (!s) continue;
      const first = rows[0];
      s.foreignKeys.push({
        name: first.fk_name,
        columns: rows.map((r) => r.column_name),
        refTable: `${first.ref_schema}.${first.ref_table}`,
        refColumns: rows.map((r) => r.ref_column),
      });
    }
    const idxByName = new Map<string, IndexRow[]>();
    for (const r of indexes) {
      const k = `${r.schema_name}.${r.table_name}::${r.index_name}`;
      if (!idxByName.has(k)) idxByName.set(k, []);
      idxByName.get(k)!.push(r);
    }
    for (const [k, rows] of idxByName) {
      const ownerKey = k.split('::')[0];
      const s = summary.get(ownerKey);
      if (!s) continue;
      const first = rows[0];
      s.indexes.push({
        name: first.index_name,
        type: first.type_desc,
        unique: first.is_unique,
        columns: rows.filter((r) => !r.is_included_column).map((r) => r.column_name),
        included: rows.filter((r) => r.is_included_column).map((r) => r.column_name),
      });
    }

    // -- Render text summary ---------------------------------------------------
    const lines: string[] = [];
    lines.push(
      `# MSSQL schema dump — ${new Date().toISOString()}`,
      `# Database: ${process.env.MSSQL_DATABASE ?? '(MSSQL_URL)'}`,
      `# Tables: ${tables.length} · Views: ${views.length}`,
      '',
    );

    const sorted = Array.from(summary.values()).sort((a, b) =>
      `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`),
    );

    // Row-count leaderboard at the top — useful at a glance for migration sizing.
    lines.push('## Row counts (largest first)');
    for (const t of [...sorted].sort((a, b) => b.rowCount - a.rowCount)) {
      lines.push(
        `  ${t.rowCount.toString().padStart(10)}  ${t.schema}.${t.name}`,
      );
    }
    lines.push('');

    for (const t of sorted) {
      lines.push('='.repeat(72));
      lines.push(`TABLE: ${t.schema}.${t.name}   rows: ${t.rowCount}`);
      lines.push('='.repeat(72));
      lines.push('Columns:');
      const widest = Math.max(...t.columns.map((c) => c.name.length), 1);
      for (const c of t.columns) {
        const flags = [
          c.identity ? 'IDENTITY' : '',
          c.nullable ? 'NULL' : 'NOT NULL',
          c.isPk ? '[PK]' : '',
        ]
          .filter(Boolean)
          .join(' ');
        lines.push(`  ${c.name.padEnd(widest)}  ${c.type}  ${flags}`);
      }
      if (t.primaryKey) {
        lines.push('');
        lines.push(
          `PK: ${t.primaryKey.name}  (${t.primaryKey.columns.join(', ')})`,
        );
      }
      if (t.foreignKeys.length > 0) {
        lines.push('');
        lines.push('FKs (outgoing):');
        for (const f of t.foreignKeys) {
          lines.push(
            `  ${f.name}: (${f.columns.join(', ')}) -> ${f.refTable}(${f.refColumns.join(', ')})`,
          );
        }
      }
      if (t.indexes.length > 0) {
        lines.push('');
        lines.push('Indexes:');
        for (const i of t.indexes) {
          const incl =
            i.included.length > 0 ? ` INCLUDE(${i.included.join(', ')})` : '';
          lines.push(
            `  ${i.name} (${i.type}${i.unique ? ', unique' : ''}): ${i.columns.join(', ')}${incl}`,
          );
        }
      }
      lines.push('');
    }

    if (views.length > 0) {
      lines.push('='.repeat(72));
      lines.push(`VIEWS (${views.length})`);
      lines.push('='.repeat(72));
      for (const v of views) {
        lines.push('');
        lines.push(`-- ${v.schema_name}.${v.view_name}`);
        lines.push(v.definition.trim());
      }
    }

    // -- Write files -----------------------------------------------------------
    const repoRoot = resolve(__dirname, '..', '..', '..');
    const txtPath = resolve(repoRoot, '.tmp', 'old_schema.txt');
    const jsonPath = resolve(repoRoot, '.tmp', 'old_schema.json');
    await mkdir(dirname(txtPath), { recursive: true });
    await writeFile(txtPath, lines.join('\n'), 'utf-8');
    await writeFile(
      jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          database: process.env.MSSQL_DATABASE ?? null,
          tables: sorted,
          views: views.map((v) => ({
            schema: v.schema_name,
            name: v.view_name,
            definition: v.definition,
          })),
        },
        null,
        2,
      ),
      'utf-8',
    );

    console.log(`wrote ${txtPath}`);
    console.log(`wrote ${jsonPath}`);
    console.log(`tables: ${tables.length}, views: ${views.length}`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
