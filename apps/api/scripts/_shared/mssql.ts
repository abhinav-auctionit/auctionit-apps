import sql from 'mssql';

/**
 * Shared MSSQL connection config builder. Honours either MSSQL_URL (a full
 * .NET-style or URL-format connection string) or the individual MSSQL_HOST /
 * MSSQL_PORT / MSSQL_DATABASE / MSSQL_USER / MSSQL_PASSWORD env vars.
 *
 * MSSQL_ENCRYPT=false disables TLS for on-prem boxes that don't have a cert
 * (Node refuses to use an IP as the TLS SNI hostname).
 */
export function buildMssqlConfig(): sql.config | string {
  if (process.env.MSSQL_URL) return process.env.MSSQL_URL;
  const host = process.env.MSSQL_HOST;
  const database = process.env.MSSQL_DATABASE;
  const user = process.env.MSSQL_USER;
  const password = process.env.MSSQL_PASSWORD;
  if (!host || !database || !user || !password) {
    throw new Error(
      'set MSSQL_URL or MSSQL_HOST + MSSQL_PORT + MSSQL_DATABASE + MSSQL_USER + MSSQL_PASSWORD',
    );
  }
  const encrypt = (process.env.MSSQL_ENCRYPT ?? 'true').toLowerCase() !== 'false';
  return {
    server: host,
    port: parseInt(process.env.MSSQL_PORT ?? '1433', 10),
    database,
    user,
    password,
    options: { encrypt, trustServerCertificate: true },
  };
}
