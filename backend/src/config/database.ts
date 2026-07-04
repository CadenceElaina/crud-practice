import { Pool } from 'pg';
/*
    A Pool, not a single Client.

    A client is one TCP connection to Postgres and if a request is 
    mid-query on it, the next request has to wait.
    A Pool keeps a handful of Clients open and hands one out 
    per query (pool.query) or for the lifetime of a checkout 
    (pool.connect), so concurrent requests aren't serialized 
    behind each other

    This Pool lives for teh whole process lifetime. 
    Created once here and imported wherever a query needs to run.
    Should NOT be closed (pool.end()) until the server itself 
    is shutting down.


One more thing on connections
Free tiers cap simultaneous DB connections — Render free allows 97 max, Neon free is 10. Your pg.Pool uses a default of 10 max connections, which is fine but worth making explicit in database.ts:

export const pool = new Pool({
// ...
max: 5, // plenty for 25 users; leave headroom for migrations/psql sessions
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 2000,
});

neon free tier is max:3
max meaning at most 3 or n simultaneous open TCP connections to Postgres. When all are busy:
req 4 arrives 
-> pool has no free connection
-> waits in an in-memory queue
-> if a connection frees up within connectionTimeoutMillis (2s) -> runrs
-> if not -> throws "timeout acquiring a connection from the pool"
the queue is in your Node process's memory, not Postgre's - they have a separate connection limit
*/
export const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT), // Node.js populates process.env strictly as string | undefined. 
    max: 5, // plenty for 25 users
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
