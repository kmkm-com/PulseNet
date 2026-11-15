// Loads server/.env (or server/.env.test for testing/seeding)
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';

const testEnvPath = fileURLToPath(new URL('../../.env.test', import.meta.url));
const defaultEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));

const isTestOrSeed =
  process.env.NODE_ENV === 'test' ||
  (process.argv[1] && (process.argv[1].includes('seed-demo') || process.argv[1].includes('test-')));

if (isTestOrSeed && fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
} else {
  dotenv.config({ path: defaultEnvPath });
}

// Support either DATABASE_URL or individual DB_* keys
if (!process.env.DATABASE_URL) {
  const REQUIRED = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD'];
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing settings in server/.env: ${missing.join(', ')} (or provide DATABASE_URL)\n` +
      'Copy .env.example to server/.env and fill in your values.'
    );
    process.exit(1);
  }
}

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in server/.env');
  process.exit(1);
}
