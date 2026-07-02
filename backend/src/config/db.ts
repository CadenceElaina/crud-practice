import {config} from 'dotenv';
import { pool } from './database';

config({quiet: true});

// explicit is typically better than relying on the 3rd party librarys naming convention
// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
/*
* Pool emits 'error' on behalf of any IDLE client it holds if a backend
error or network partition happens to that connection. Without this
listener, an unhandled 'error' event would crash the process with an
unhelpful stack trace. We log it and exit deliberately instead. A dead
DB connection isn't something the app should try to move along without.
*/
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})
 
async function connectToPool(){
const client = await pool.connect()
console.log('DB connection successful');
//const res = await client.query('SELECT * FROM users WHERE id = $1', [1])
//console.log(res.rows[0])
 
client.release(); // Give the connection back to the pool and never call pool.end() here, the pool needs to stay alive for the server's whole lifetime
//await pool.end(); pool needs to stay alive accross servers whole lifetime not close after one query
}

if (require.main === module) {
  connectToPool().catch((err) => console.error('DB connection fialed:',err));
}

export { pool }; // allow other modules (route handlers) reuse this one shared connection pool.
/*
  `module` always refers to THIS file's own module object.
  `require.main` always points at whichever file was the actual entry
  point of the process (the file you ran with `node` / `tsx`).

  index.ts does `import { pool } from '.config/db'`, so when teh server
  starts, index.ts is require.main and this file (db.ts) is just `module`
  theyre different objects, so this block does NOT run on normal import.
  It only runs if you execute this file directly, e.g. `npx tsx src/config/db.ts`,
  which makes it a handly standalone for "can I reach the database?" - test.
*/

// module always refers to the current files own module object - inside db.ts, module always means "db.ts" no matter whos running it
// require.main always points to whatever file was the original entry point 
// index.ts does import {pool} from './db' -> index.ts is the entry point -> require.main (pointing at index) and module (pointing at db) are two different objects -> false -> connectToPool() does not auto-run on import
//so it prevents other files from running it on import? module -> current files own module object and require.main -> whichever file was the original entry point also why is Number the container obj used for the env var
