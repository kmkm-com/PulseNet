// Loads server/.env and checks required settings before anything else runs.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

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
