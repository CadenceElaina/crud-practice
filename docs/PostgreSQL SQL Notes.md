# PostgreSQL & SQL Notes

## node-postgres (`pg`)

### Client vs Pool

```
Single Client
  → one connection, one query at a time (FIFO — network socket limitation, not Postgres)
  → fine for scripts, migrations, one-off tools

Pool
  → manages multiple connections, Postgres runs queries concurrently
  → use this for anything your server handles at runtime
```

New connection = 20–30ms handshake (passwords, config, SSL) — incurred every time with a raw Client.  
Pool keeps connections alive and checks them out/back in as needed.

> Crash prod example: opened new clients and never released them in a Python app — "It was not fun." Always `client.release()`.

### Basic Connection (Client)

```typescript
import { Client } from "pg";

const client = new Client();
await client.connect();

try {
  const res = await client.query("SELECT $1::text AS message", [
    "Hello world!",
  ]);
  console.log(res.rows[0].message);
} catch (err) {
  console.error(err);
} finally {
  await client.end();
}
```

### Pool Setup

```typescript
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT), //Why Number over number?
  max: 20, // max simultaneous clients
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 2000, // throw if can't connect in 2s
  maxLifetimeSeconds: 60, // recycle connections after 60s
});

// Catch errors on idle clients (network partition, backend crash)
pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});
```

### Querying

```typescript
// Single query — pool auto-manages checkout/release
const result = await pool.query("SELECT * FROM users WHERE id = $1", [1]);

// Manual checkout — use for transactions - explain difference between transactions vs single queries?
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const res = await client.query("SELECT * FROM users WHERE id = $1", [1]);
  await client.query("COMMIT");
  return res.rows[0];
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release(); // ALWAYS release — pool drains and future requests hang forever if you don't
}

// Shutdown (waits for all checked-out clients to return first)
await pool.end();
```

### async vs callback execution order

// explain what a callback and async op are?

```typescript
console.log("starting async query");
const result = await pool.query("SELECT NOW()");
console.log("async query finished");

console.log("starting callback query");
pool.query("SELECT NOW()", (err, res) => {
  console.log("callback query finished");
});

console.log("calling end");
await pool.end();
console.log("pool has drained");

// Output:
// starting async query
// async query finished
// starting callback query
// calling end
// callback query finished   ← callback runs before pool drains
// pool has drained
```

---

## ACID

|       | Property    | Meaning                                                      |
| ----- | ----------- | ------------------------------------------------------------ |
| **A** | Atomicity   | Transactions are all-or-nothing                              |
| **C** | Consistency | Valid DB state → valid DB state                              |
| **I** | Isolation   | Transactions don't affect each other                         |
| **D** | Durability  | Changes are permanent after commit — survives server restart |

---

## Schema Design

### Normalization: Why Junction Tables

PostgreSQL supports `TEXT[]` arrays but storing tags as a column array violates [First Normal Form (1NF)](https://en.wikipedia.org/wiki/First_normal_form) — can't cleanly query or index into it.

Junction tables (`note_tags`, `note_lists`) instead:

- Composite PK `PRIMARY KEY (note_id, tag_id)` prevents duplicate pairings at the DB level
  - Without it: you could insert note 5 → tag 3 five separate times
- Each FK column is independently indexable
- `INNER JOIN` through the junction to filter by tag or list

### SERIAL

`SERIAL` = strictly incrementing sequence, no reuse of deleted IDs — just "last value + 1" forever.  
Insert a row without specifying the ID column → Postgres auto-generates it.  
MySQL equivalent: `INT AUTO_INCREMENT`.

### ON DELETE CASCADE vs ON DELETE SET NULL

A note can exist independently of any list — it's a real object on its own. When its list disappears, the note survives with `list_id = NULL`. A row in `note_tags` isn't an independent thing at all — it only exists to represent "this note is linked to this tag." If the note's gone, that link is meaningless.

```
ON DELETE CASCADE  → dependent row has no identity without its parent
                     note_tags: note's gone → link is gone

ON DELETE SET NULL → dependent row is independent, just references a parent
                     notes.list_id: list deleted → note survives, list_id = NULL
```

### CASCADE direction: parent → child, never child → parent

The child table holds the FK columns pointing UP to the parent. Cascade flows DOWN.

```
DELETE note (parent of note_tags / note_lists)
  → Postgres finds all note_tags rows where note_id matches → deletes them

DELETE list (parent of note_lists)
  → same, but targeting list_id
```

### B-Tree Indexes

Postgres uses B-Tree by default — a **sorted, branching structure**, not a hash table.

```sql
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```

What Postgres does when you create this:

1. Allocates separate disk storage for `idx_note_tags_tag_id`
2. Scans `note_tags`, extracts every `tag_id` and pairs it with a **TID (Tuple ID)** — a pointer to where the row lives on disk
3. Organizes those pairs into a B-Tree sorted by `tag_id`

**B-Tree vs Hash Table**  
Hash tables handle exact lookups only.  
B-Trees handle exact lookups AND range queries (`WHERE tag_id > 5`, `ORDER BY`, etc.) — efficiently because entries are kept in sorted order. A single node can have hundreds of children (keys), which keeps the tree shallow.

---

## BEFORE UPDATE Trigger

Tracks `updated_at` without touching timestamps in application code. Schema intercepts the operation in memory before anything hits disk.

### Disk Write Pipeline

```
UPDATE issued
  → Postgres builds new row in memory
  → BEFORE triggers fire   ← row is still editable here (NEW is accessible, modifiable)
  → row written to disk (table storage)
  → AFTER triggers fire    ← row already written, not editable
  → COMMIT → transaction is permanent
```

DISK is just storage. The interesting stuff happens before the write.

### BEFORE UPDATE: step by step

1. `UPDATE notes SET title = 'new title' WHERE note_id = 1`
2. Postgres builds the new row in memory — `title = 'new title'`, but `updated_at` still has the stale value
3. Trigger is `BEFORE UPDATE` → Postgres pauses and hands the in-memory row to the trigger function as `NEW`
4. `NEW.updated_at = NOW()` — overwrites the stale timestamp
5. `RETURN NEW` — hands the modified row back to Postgres
6. Postgres writes to disk

> `NEW` isn't just `updated_at` — it's the **entire row** as it will exist after the write. Trigger overwrites one field and returns the whole thing.  
> `RETURNS TRIGGER` is a special pseudo-type for trigger functions only. `NEW` and `OLD` only exist in a trigger context.

```sql
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_notes_modtime
BEFORE UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
```

---

## SQL Reference

### JOIN vs UNION

- **JOIN** — combines tables **horizontally** (adds columns side-by-side based on a match condition)
- **UNION** — combines tables **vertically** (stacks rows from two queries on top of each other)

### JOIN Types

```sql
-- INNER JOIN: rows with a match in BOTH tables only
SELECT u.name, o.order_id FROM users u
INNER JOIN orders o ON u.user_id = o.user_id;
-- users with no orders are excluded

-- LEFT JOIN: all rows from left table, NULL on right if no match
SELECT u.name, o.order_id FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id;
-- users with no orders still appear, order_id is NULL

-- RIGHT JOIN: all rows from right table — most devs just flip LEFT JOIN instead
-- FULL OUTER JOIN: all rows from both, NULLs on whichever side has no match
```

### Multi-table JOINs (this schema)

```sql
-- Notes in a specific list
SELECT n.note_id, n.title, n.content, l.name AS list_name
FROM notes n
INNER JOIN note_lists nl ON n.note_id = nl.note_id
INNER JOIN lists l ON nl.list_id = l.list_id
WHERE l.name = 'Work';

-- Notes with a specific tag (ILIKE = case-insensitive LIKE)
SELECT n.note_id, n.title, t.tag_name
FROM notes n
INNER JOIN note_tags nt ON n.note_id = nt.note_id
INNER JOIN tags t ON nt.tag_id = t.tag_id
WHERE t.tag_name ILIKE 'urgent';

-- Filter by BOTH list AND tag
SELECT n.note_id, n.title
FROM notes n
INNER JOIN note_lists nl ON n.note_id = nl.note_id
INNER JOIN lists l ON nl.list_id = l.list_id
INNER JOIN note_tags nt ON n.note_id = nt.note_id
INNER JOIN tags t ON nt.tag_id = t.tag_id
WHERE l.name = 'Work' AND t.tag_name = 'Urgent';
```

### Time-Based Filtering

```sql
-- Notes created in last 7 days
SELECT title, created_at
FROM notes
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Notes that have been edited since creation
SELECT title FROM notes
WHERE updated_at > created_at;
```

### Filtering "Orphaned" Data (LEFT JOIN + NULL check)

Data that isn't connected to anything — LEFT JOIN and check for NULL on the joined side.

```sql
-- Notes not in any list
SELECT n.title FROM notes n
LEFT JOIN note_lists nl ON n.note_id = nl.note_id
WHERE nl.list_id IS NULL; -- NULL means no entry in the junction table

-- Tags not applied to any note
SELECT t.tag_name FROM tags t
LEFT JOIN note_tags nt ON t.tag_id = nt.tag_id
WHERE nt.note_id IS NULL;
```

### Aggregation (GROUP BY + HAVING)

`WHERE` filters rows. `HAVING` filters after grouping — use it to filter on aggregate values like `COUNT`.

```sql
-- Tags used on more than 5 notes
SELECT t.tag_name, COUNT(nt.note_id) AS note_count
FROM tags t
INNER JOIN note_tags nt ON t.tag_id = nt.tag_id
GROUP BY t.tag_id, t.tag_name
HAVING COUNT(nt.note_id) > 5;
```

### WHERE Else Can a SELECT Go?

```sql
-- 1. In FROM / JOIN — acts as a derived table (subquery returns rows + columns)
SELECT e.name, dept.budget
FROM employees e
INNER JOIN (
    SELECT dept_id, SUM(budget) AS budget
    FROM departments
    GROUP BY dept_id
) AS dept ON e.dept_id = dept.dept_id;

-- 2. In SELECT clause — scalar subquery (must return exactly 1 row, 1 column)
SELECT name, (SELECT MAX(salary) FROM employees) AS highest_salary
FROM employees;

-- 3. In HAVING clause
SELECT dept_id, AVG(salary) FROM employees
GROUP BY dept_id
HAVING AVG(salary) > (SELECT AVG(salary) FROM employees);

-- ⚠️ Cannot use SELECT inside GROUP BY or ORDER BY — those expect column names/expressions only
```

### Pagination

**Standard: LIMIT / OFFSET**

```sql
-- Page 3, 10 rows per page (OFFSET = (page - 1) * page_size)
SELECT note_id, title, updated_at
FROM notes
WHERE user_id = 1
ORDER BY updated_at DESC
LIMIT 10 OFFSET 20;
```

Problem: if a new row is inserted while a user is on page 1, everything shifts by one — page 2 shows the last item from page 1 again. Also, high `OFFSET` values (like 50000) are slow because Postgres still scans all preceding rows just to discard them.

**Keyset Pagination (cursor-based)**

Instead of "skip N rows," say "give me rows older than the last thing I saw."

```sql
-- Page 1
SELECT note_id, title, updated_at
FROM notes
WHERE user_id = 1
ORDER BY updated_at DESC, note_id DESC
LIMIT 10;

-- Page 2: pass last row's updated_at and note_id as cursor
SELECT note_id, title, updated_at
FROM notes
WHERE user_id = 1
  AND (updated_at, note_id) < ('2026-06-27 12:00:00'::timestamptz, 45)
ORDER BY updated_at DESC, note_id DESC
LIMIT 10;
```

The `(updated_at, note_id) < (...)` is a **row-values comparison** — evaluates both together so ties on `updated_at` are broken by `note_id`. No duplicates, no skipped rows, stays fast regardless of how deep into the dataset you are.

Use keyset for infinite-scroll / feeds. LIMIT/OFFSET is fine for small datasets or admin tooling.

---

## Early Schema Evolution (Historical)

> Rough drafts written before `schema.sql` was finalized — kept as a record of iteration. Source of truth is `backend/schema.sql`.

### Very first sketch (pseudocode)

```
notes:
  PK: note_id (int)
  author: varchar(50)       ← later became a separate users table
  title: varchar(50)
  body: varchar(???)        ← settled on TEXT (no limit)
  tags: varchar()           ← abandoned; junction table instead (1NF)
  FK: list_id               ← later moved to note_lists junction table
  created_at
  updated_at
```

### First working draft (author-based, list_id directly on notes)

```sql
-- 'author' instead of 'users' — later renamed, added email/password/last_login
CREATE TABLE author (
    author_id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- list_id was a direct FK on notes — later moved to note_lists junction (many-to-many)
CREATE TABLE notes (
    note_id SERIAL PRIMARY KEY,
    author_id INT REFERENCES author(author_id) ON DELETE SET NULL,
    title VARCHAR(100) NOT NULL,
    content TEXT,
    list_id INT REFERENCES lists(list_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger had a typo here: 'plpsql' → corrected to 'plpgsql' in final schema
$$ LANGUAGE 'plpgsql';
```

**What changed from draft → final:**

- `author` → `users` (added `email`, `password VARCHAR(500)`, `last_login`)
- `list_id` removed from `notes` → moved to `note_lists` junction table (supports many-to-many)
- Tags column → `tags` table + `note_tags` junction table
- Added `pinned BOOLEAN DEFAULT FALSE` on notes
- Added `updated_at` trigger on `lists` and `tags` tables too
