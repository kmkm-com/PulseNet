/**
 * Database Safety & Target Environment Validator
 * Enforces strict isolation: Destructive operations, test executions, and demo seeding
 * are restricted exclusively to approved local disposable PostgreSQL databases.
 */

const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const ALLOWED_DISPOSABLE_DATABASES = new Set([
  'pulsenet_test',
  'pulsenet_test_schema',
  'pulsenet_test_migrations',
  'pulsenet_dev',
  'pulsenet_db'
]);

export function validateSafeTestTarget(options = {}) {
  const { operation = 'Operation' } = options;

  let host = process.env.DB_HOST;
  let dbName = process.env.DB_NAME;
  const rawUrl = process.env.DATABASE_URL;

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      host = parsed.hostname;
      dbName = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
    } catch {
      throw new Error(`SAFETY ABORT: ${operation} encountered an unparseable or ambiguous DATABASE_URL.`);
    }
  }

  if (!host || !dbName) {
    throw new Error(`SAFETY ABORT: ${operation} requires explicit database host and database name configuration.`);
  }

  // 1. Host validation: MUST be in ALLOWED_LOCAL_HOSTS
  if (!ALLOWED_LOCAL_HOSTS.has(host.toLowerCase())) {
    throw new Error(
      `SAFETY ABORT: ${operation} blocked! Target host '${host}' is not in the approved local host allowlist (localhost, 127.0.0.1). Destructive operations are forbidden on remote databases.`
    );
  }

  // 2. Reject remote/pooler keywords regardless of host
  if (host.includes('supabase') || host.includes('pooler') || host.includes('aws') || host.includes('render')) {
    throw new Error(`SAFETY ABORT: ${operation} blocked! Remote infrastructure detected in target host.`);
  }

  // 3. Database name validation: MUST be an approved disposable database
  if (!ALLOWED_DISPOSABLE_DATABASES.has(dbName.toLowerCase())) {
    throw new Error(
      `SAFETY ABORT: ${operation} blocked! Target database '${dbName}' is not in the approved disposable test database allowlist. Production or default databases (such as 'postgres') cannot be used for destructive testing or seeding.`
    );
  }

  return { host, database: dbName };
}
