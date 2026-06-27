// 06/27/26
module always refers to the current file's module object. require.main refers to whichever file was originally executed as teh entry point (node dist/index.js) - when you run db.ts/db.js directly those two are the same object when something else import's it theyre not.

---

node-postgres.com
npm install pg

Basic Connection
import {Client} from 'pg'
const client = await new Client().connect()
const res = await client.query('SELECT $1::text as message', ['Hello world!'])
console.log(res.rows[0].message)
await client.end()

Error Handling
import {Client} from 'pg'
const client = await new Client().connect()

try{
const res = await client.query('SELECT $1:: text as message', ['Hello world!'])
console.log(res.rows[0].message)
} catch (err) {
console.error(err)
} finally {
await client.end()
}

Pooling
connection pool to manage your connections - freq queries? use a connection pool
connection to PostgreSQL requires 20-30ms handshake. passwords, config info, ssl might be established... incurring this cost every time slows down the app. PostgresSQL server can handle a limited number of clients at a time.
-- crash prod ex: open new clietns and never disconnecting them in a python app - "It was not fun."
xd
PostgresSQL can only process one query at a time (isolation ACID When we say a single Node.js Client can only run one query at a time, that is a limitation of the network socket connection between your Node app and Postgres, not Postgres itself.

Postgres is heavily concurrent. It spins up a separate process for every connection it receives. If 50 users hit your server at once and you use a Pool, Postgres will gladly execute all 50 queries simultaneously. If you use a single Client, Node has to queue those 50 queries up and send them down the pipeline one by one.) in a single connected client in a firt in first out manner

// single query - no transaciton
import pg from 'pg'
const {Pool} = pg
const pool = new Pool()
// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on('error', (err, client) => {
console.error('Unexpected error on idle client', err)
process.exit(-1)
})

const client = await pool.connect()
const res = await client.query('SELECT \* FROM users WHERE id = $1', [1])
console.log(res.rows[0])
client.release()
// must always return the client ot the pool - otherwise your app will leak them and eventuall your pool will be empty forever and all future requests to check out a client from the pool will wait forever.

// shutdown
pool.end() - waits for all checked-out clients to be returned and the nshut down all the clients and pool timers.

import pg from 'pg'
const {Pool} = pg
const pool = new Pool()

console.log('starting async query')
const result = await pool.query('SELECT NOW()')
console.log('async query finished')

console.log('starting callback query')
pool.query('SELECT NOW()', (err, res) => {
console.log('callback query finished')
})

console.log('calling end')
await pool.end()
console.log('pool has drained >;3')

// output: starting async query
async query finished
starting callback query
calling end
callback query finished
pool has drained

new Pool(config: Config) -- constructs new pool instance - created empty

example to create a new pool with configuration:

import { Pool } from 'pg'

const pool = new Pool({
host: 'localhost',
user: 'database-user',
max: 20,
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 2000,
maxLifetimeSeconds: 60,
})
