# Dev Tools & Quick Reference

## Request / Response Flow

```
Request
  → Route        (which path? which method?)
  → Middleware   (auth check, body parsing, etc.)
  → Controller   (what do we need from req? what do we send back?)
  → Service      (do the actual work / hit the DB)
  → Controller   (format and return res)
```

## Express

### Middleware

Every incoming request passes through a chain of functions before it reaches a route handler. Signature: `(req, res, next)`.

- Order matters — top to bottom, every request
- `express.json()` — reads the raw request body, parses it as JSON, attaches result to `req.body`
  - Without this `req.body` stays `undefined`

### POST request flow

```
express parses body
  → pg sends parameterized query
  → postgres inserts and returns the row
  → express serializes it to JSON
```

### AuthenticatedRequest (TypeScript)

Extend `Request` to attach `userId` after JWT verification:

```typescript
// src/models/types.ts
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
    userId?: number; // matches SERIAL (INT) user_id from Postgres
}
```

Named export (for shared use across files):
```typescript
import type { AuthenticatedRequest } from '../models/types';
```

Default export (if only used in one place):
```typescript
export default interface AuthenticatedRequest extends Request { ... }
import AuthenticatedRequest from '../types';
```

Most backend devs keep these in a dedicated `src/types.ts` or `src/custom.d.ts` to keep `index.ts` clean.

---

## Node.js

### module vs require.main

`module` — always refers to the **current file's** module object  
`require.main` — always refers to **whichever file was the original entry point** (e.g. `node dist/index.js`)

```
Run db.ts directly    → module === require.main → true  → connectToPool() runs
index.ts imports db.ts → module !== require.main → false → connectToPool() doesn't auto-run
```

```typescript
// Guard: only execute if this file was run directly (not imported)
if (require.main === module) {
    connectToPool().catch((err) => console.error('DB connection failed:', err));
}
```

### deps vs devDeps

**dependencies** — packages your app needs at runtime (must exist on the prod machine)  
**devDependencies** — only needed while building/developing (never needed in prod)

TypeScript is a compiler: `.ts → dist/*.js → Node runs the compiled JS`. TS itself never ships.

```
TypeScript, tsx, ts-node, @types/* → devDependencies
express, pg, dotenv, bcrypt, jsonwebtoken, cors → dependencies
```

`dotenv` loads env vars at runtime, every time the app boots, including in prod → **regular dependency**.

```bash
npm install express dotenv cors bcrypt jsonwebtoken pg
npm install --save-dev typescript tsx @types/node @types/express @types/pg @types/bcrypt @types/cors @types/jsonwebtoken
```

---

## psql CLI

> psql uses `--` for comments, not `#`

```bash
# Check if PostgreSQL is running
pg_isready

# Create a new database
sudo -u postgres createdb name_of_db

# Create a new user interactively
sudo -u postgres createuser --interactive

# Connect via psql shell
psql name_of_db

# Connect over TCP (matches how Node's pg connects)
psql -h localhost -U your_user -d name_of_db

# Run a schema file against a database
psql -d name_of_db -f path/to/schema.sql

# Common shell commands
\dt             # list all tables in the current db
\d table_name   # describe a table's columns and constraints
\q              # quit
```

**`-h localhost` flag** — forces psql to connect over TCP instead of the Unix socket.  
Node's `pg` library connects over TCP by default — use this flag when you want your CLI session to behave the same way.

---

## Git

```bash
git add .     # stages changes ONLY in the current directory and below
git add -A    # stages ALL changes across the ENTIRE repo regardless of where you're running from
```

Prefer `git add -A` from repo root — `git add .` can miss changes in parent dirs if you're in a subdirectory.

---

## npm Setup (TS + Express + Postgres from scratch)

```bash
npm init -y
npm install express dotenv cors bcrypt jsonwebtoken pg
npm install --save-dev typescript tsx @types/node @types/express @types/pg @types/bcrypt @types/cors @types/jsonwebtoken
npx tsc --init   # generates tsconfig.json — configure rootDir, outDir, module, target
```

`package.json` scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "npx tsx src/index.ts"
  }
}
```

Minimal working server:
```typescript
import express, { Request, Response } from 'express';
const app = express();
const PORT: number = Number(process.env.PORT) || 3000;
// Number (capital) = JS wrapper object. number (lowercase) = TS primitive type. Always use lowercase for annotations.

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Hello');
});

app.listen(PORT, () => {
    console.log(`Listening on http://localhost:${PORT}`);
});
```
