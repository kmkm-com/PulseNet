// Loads server/.env and checks required settings before anything else runs.
// Import this first (index.js and db/pool.js do) so a missing setting stops
// the server with a clear message instead of failing on the first request.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Resolve relative to this file, so it works no matter which folder
// the server is started from
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const REQUIRED = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD', 'JWT_SECRET'];
const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `Missing settings in server/.env: ${missing.join(', ')}\n` +
    'Copy .env.example to server/.env and fill in your values.'
  );
  process.exit(1);
}
