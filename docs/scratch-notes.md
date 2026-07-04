/\*
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

Capacity math for free tiers
Constraint that matters most typically is the database storage limit commonly ~256MB - 1GB across Render/Supabase/etc.

ThingAvg sizeNotesUser row~300 bytesname, email, bcrypt hash, timestampsNote row (no content)~200 bytesmetadata onlyNote content1–5 KB typical, 50KB maxTEXT column, the real variableList row~150 bytesTag row~100 bytesJunction row~20 bytesnote_tags, note_listsIndex overhead~30–50% on toprough rule of thumb

Conservative (500 notes/user, 3KB avg content):
25 users × 500 notes × 3KB = 37.5MB content

- metadata + indexes (~2x multiplier) = ~80MB total

Still fine on 512MB+, tight on 256MB.
The ceiling that matters: a single very long note is TEXT with no DB-level limit. One user pasting a 1MB novel into the content field 100 times is 100MB from one person. Enforce a soft cap at the API layer, not the schema.

ResourcePer-user limitReasoningUsers25 totalalready decidedNotes300generous for 25 users, leaves plenty of headroomLists20more than most people ever useTags50comfortable tag vocabularyNote content50,000 chars (~50KB)~10x a typical long blog post; still a note appNote title100 charsalready in schemaTag name30 charsalready in schema

With these limits, worst case storage: 25 × 300 notes × 50KB = 375MB content, ~750MB with overhead. That's your 90% threshold on a 1GB free tier. On 256MB you'd want to drop notes to 100 or content to 10KB.

The 90% rule you mentioned is right — set a WARN_STORAGE_MB env var and add a startup check or a cron-style log line comparing SELECT pg_database_size('notesdb') against it. When you hit 90% of your tier limit, that's your upgrade signal. Neon in particular shows this clearly in their dashboard.

One more thing on connections
Free tiers cap simultaneous DB connections — Render free allows 97 max, Neon free is 10. Your pg.Pool uses a default of 10 max connections, which is fine but worth making explicit in database.ts:

export const pool = new Pool({
// ...
max: 5, // plenty for 25 users; leave headroom for migrations/psql sessions
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 2000,
});
