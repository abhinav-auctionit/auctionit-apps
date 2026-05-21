/**
 * Side-effect import that loads env vars in this precedence (first one set
 * wins, so list base values first and overrides last):
 *
 *   1. apps/api/.env                 — base app config (DATABASE_URL etc.)
 *   2. apps/api/.env.mssql.local     — migration-only MSSQL credentials
 *
 * `dotenv` does NOT override existing keys by default, which is what we want
 * for the few keys that overlap (none today). Replace `import 'dotenv/config'`
 * at the top of any importer script with `import './_shared/load-env'`.
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

const apiRoot = resolve(__dirname, '..', '..');

config({ path: resolve(apiRoot, '.env') });
config({ path: resolve(apiRoot, '.env.mssql.local') });
