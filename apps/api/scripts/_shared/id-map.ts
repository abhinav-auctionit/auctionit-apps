import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * Persists source-ID → target-UUID maps to .tmp/id-maps/<entity>.json so
 * downstream importers can resolve FKs without re-querying Postgres.
 *
 * Path is repo-root-relative (.tmp/id-maps/...) — scripts run from anywhere
 * in the monorepo end up writing to the same place.
 */

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');

function pathFor(entity: string): string {
  return resolve(REPO_ROOT, '.tmp', 'id-maps', `${entity}.json`);
}

export async function saveIdMap(
  entity: string,
  map: Map<number | string, string>,
): Promise<string> {
  const path = pathFor(entity);
  await mkdir(dirname(path), { recursive: true });
  const obj: Record<string, string> = {};
  for (const [k, v] of map) obj[String(k)] = v;
  await writeFile(path, JSON.stringify(obj, null, 2), 'utf-8');
  return path;
}

export async function loadIdMap(entity: string): Promise<Map<string, string>> {
  const path = pathFor(entity);
  try {
    const raw = await readFile(path, 'utf-8');
    const obj = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(obj));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return new Map();
    throw err;
  }
}
