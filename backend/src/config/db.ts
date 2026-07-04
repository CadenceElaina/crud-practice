import {config} from 'dotenv';
import { Pool } from 'pg';

config({quiet: true});

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT), // Node.js populates process.env strictly as string | undefined. 
    max: 5, // plenty for 25 users
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})
 
async function connectToPool(){
const client = await pool.connect()
console.log('DB connection successful');

 
client.release(); // Give the connection back to the pool and never call pool.end() here, the pool needs to stay alive for the server's whole lifetime
//await pool.end(); pool needs to stay alive accross servers whole lifetime not close after one query
}

if (require.main === module) {
  connectToPool().catch((err) => console.error('DB connection fialed:',err));
}

export { pool }; // allow other modules (route handlers) reuse this one shared connection pool.
export const closePool = (): Promise<void> => pool.end();