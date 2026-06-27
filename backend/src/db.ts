//import pg from 'pg'
//const {Pool} = pg
//require('dotenv').config();
import {config} from 'dotenv';
import { Pool } from 'pg';

config();

//const pool = new Pool()
// explicit is typically better than relying on the 3rd party librarys naming convention
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
});

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})
 
async function connectToPool(){
const client = await pool.connect()
console.log('DB connection successful');
//const res = await client.query('SELECT * FROM users WHERE id = $1', [1])
//console.log(res.rows[0])
 
client.release();
//await pool.end(); pool needs to stay alive accross servers whole lifetime not close after one query
}

// module always refers to the current files own module object - inside db.ts, module always means "db.ts" no matter whos running it
// require.main always points to whatever file was the original entry point 
// index.ts does import {pool} from './db' -> index.ts is the entry point -> require.main (pointing at index) and module (pointing at db) are two different objects -> false -> connectToPool() does not auto-run on import
//so it prevents other files from running it on import? module -> current files own module object and require.main -> whichever file was the original entry point also why is Number the container obj used for the env var
if (require.main === module) {
  connectToPool().catch((err) => console.error('DB connection fialed:',err));
}

export { pool }; // allow other modules (route handlers) reuse this one shared connection pool.