# crud-app

Minimal CRUD API — TypeScript, Node.js, Express, PostgreSQL. Built as a learning artifact and starter template. Auth included.

> **Repo 1 of 2.** Deliberately simple and complete. Once done, it's frozen — a reference, not a product. See `docs/crud-app-repo1-repo2.txt` for Repo 2 context.

---

## Stack

| Layer     | Technology                      |
| --------- | ------------------------------- |
| Runtime   | Node.js ≥ 20                    |
| Language  | TypeScript                      |
| Framework | Express 5                       |
| Database  | PostgreSQL                      |
| Auth      | JWT (`jsonwebtoken`) + `bcrypt` |
| DB Client | `node-postgres` (`pg`)          |
| Frontend  | React 19 + Vite                 |

---

## Quick Start

**Prerequisites:** Node.js ≥ 20, PostgreSQL running locally.

```bash
# 1. Install backend dependencies
cd backend && npm install

# 2. Configure environment
cp .env.example .env
# Fill in your DB credentials and a JWT_SECRET

# 3. Create the database and run the schema
createdb notesdb
psql -d notesdb -f backend/schema.sql

# 4. Start the server
npm run build && npm start

# Dev mode (no build step)
npx tsx src/index.ts
```

Server runs at `http://localhost:5000` by default (configurable via `PORT` in `.env`).

---

## Project Structure

```
crud-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts        # pg Pool configuration
│   │   │   └── db.ts              # Pool error handling + re-export
│   │   ├── controllers/           # HTTP layer — parse req, format res
│   │   │   ├── userController.ts
│   │   │   └── noteController.ts
│   │   ├── middlewares/
│   │   │   └── auth.ts            # JWT verification middleware
│   │   ├── models/
│   │   │   └── types.ts           # Shared TypeScript interfaces
│   │   ├── routes/                # Route definitions → controllers
│   │   │   ├── usersRoutes.ts
│   │   │   └── noteRoutes.ts
│   │   ├── services/              # Business logic + DB queries (no req/res)
│   │   │   ├── userService.ts
│   │   │   └── noteService.ts
│   │   └── index.ts               # Entry point, middleware setup, app.listen
│   ├── schema.sql                 # Database schema (idempotent DDL)
│   ├── package.json
│   └── tsconfig.json
├── src/                           # Frontend (React + Vite)
│   ├── App.tsx
│   └── main.tsx
├── docs/                          # Learning notes — not part of the app
├── index.html
└── package.json                   # Frontend package
```

### Request Flow

```
Request
  → Route       (which path/method?)
  → Middleware  (auth check, body parsing)
  → Controller  (what do we need from req? what do we send back?)
  → Service     (do the actual work, hit the DB)
  → Controller  (format and return res)
```

---

## API Reference

### Public Routes

| Method | Endpoint     | Body                        | Description                    |
| ------ | ------------ | --------------------------- | ------------------------------ |
| `POST` | `/api/users` | `{ name, email, password }` | Register a new user            |
| `GET`  | `/api/users` | —                           | All users (passwords excluded) |
| `POST` | `/api/login` | `{ email, password }`       | Login — returns JWT            |
| `GET`  | `/health`    | —                           | Health check                   |

### Protected Routes

Requires header: `Authorization: Bearer <token>`

| Method   | Endpoint         | Body                           | Description                          |
| -------- | ---------------- | ------------------------------ | ------------------------------------ |
| `GET`    | `/api/notes`     | —                              | All notes for the authenticated user |
| `POST`   | `/api/notes`     | `{ title, content, list_id? }` | Create a note                        |
| `PUT`    | `/api/notes/:id` | `{ title, content }`           | Update a note                        |
| `DELETE` | `/api/notes/:id` | —                              | Delete a note                        |

### Query Filters (`GET /api/notes`)

```
?list_id=3                    Filter by list
?search=keyword               Full-text search across title and content
?list_id=3&search=keyword     Combined
```

---

## Database Schema

Six tables: `users`, `notes`, `lists`, `tags`, `note_tags` (junction), `note_lists` (junction).

**Key decisions:**

- Deleting a user cascades to their notes (`ON DELETE CASCADE`)
- Deleting a list nullifies the reference on surviving notes (`ON DELETE SET NULL`)
- Note ↔ tag and note ↔ list relationships are many-to-many via junction tables
- `updated_at` is maintained by a `BEFORE UPDATE` trigger — no application-side timestamp logic needed
- Passwords stored as bcrypt hashes (`VARCHAR(500)` gives headroom for future algorithm changes)

See `backend/schema.sql` for the full annotated schema.

---

## Using as a Template

1. **Schema** — replace `schema.sql` with your tables. Keep the trigger pattern for `updated_at`.
2. **Services** — one file per resource, no Express types. Pure data access, returns rows.
3. **Controllers** — one file per resource, no DB logic. Only `req`/`res`.
4. **Routes** — register with `app.use('/api', yourRouter)` in `index.ts`.
5. **Types** — add shared interfaces to `models/types.ts`.
6. **Auth** — `auth.ts` middleware is drop-in. Attaches `req.userId` from JWT payload.

---

## Testing

See `docs/test_routes_use_postman.txt` for the full Postman guide (includes auth header setup for protected routes).

**Quick smoke test:**

```bash
# Health check
curl http://localhost:5000/health

# Register
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex","email":"alex@example.com","password":"secret"}'

# Get all users
curl http://localhost:5000/api/users
```

---

## Environment Variables

See `.env.example`. Required:

| Variable      | Description                          |
| ------------- | ------------------------------------ |
| `DB_USER`     | PostgreSQL username                  |
| `DB_PASSWORD` | PostgreSQL password                  |
| `DB_HOST`     | Database host (default: `localhost`) |
| `DB_PORT`     | Database port (default: `5432`)      |
| `DB_NAME`     | Database name                        |
| `PORT`        | Server port (default: `5000`)        |
| `SECRET`      | JWT signing secret                   |

---

## License

ISC
