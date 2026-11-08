//database connection pool for postgresql
import pg from 'pg';
import '../config/env.js'; // loads server/.env before the pool reads it

const{Pool} = pg;
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
}); // port where postgres listens = 5432 default

export default pool; // exports pool instance