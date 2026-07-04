# crud-app

Minimal CRUD API — TypeScript, Node.js, Express, PostgreSQL. Built as a learning artifact and starter template. Auth included.

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

## Local Setup

### Prerequisites

- Node.js >= 20
- PostgreSQL running locally

### 1. Clone

```bash
git clone <repo-url>
cd crud-app
```

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Environment

```bash
cp .env.example .env
# Open .env and fill in DB_USER, DB_PASSWORD, DB_NAME=notesdb, SECRET
```

### 4. Create databases

```bash
createdb notesdb
createdb notesdb_test
```

### 5. Run schema

```bash
# From crud-app/backend/
psql -d notesdb -f schema.sql
psql -d notesdb_test -f schema.sql
```

### 6. Start server

```bash
# Dev (no build step)
npx tsx src/index.ts

# Production
npm run build && npm start
```

### 7. Run tests

```bash
npm test
```

Server runs at `http://localhost:5000` by default.

## Project Structure

```
## Project Structure

```

crud-app/
├── backend/
│ ├── src/
│ │ ├── config/
│ │ │ ├── database.ts # pg Pool configuration
│ │ │ └── db.ts # Pool error handling + re-export
│ │ ├── controllers/ # HTTP layer — parse req, call service, format res
│ │ │ ├── userController.ts
│ │ │ ├── noteController.ts
│ │ │ ├── listController.ts
│ │ │ └── tagController.ts
│ │ ├── middleware/
│ │ │ └── auth.ts # JWT verification — attaches req.userId
│ │ ├── models/
│ │ │ └── types.ts # Shared TypeScript interfaces
│ │ ├── routes/ # Route definitions → controllers
│ │ │ ├── usersRoutes.ts
│ │ │ ├── noteRoutes.ts
│ │ │ ├── listRoutes.ts
│ │ │ └── tagRoutes.ts
│ │ ├── services/ # DB queries — no req/res, returns typed rows
│ │ │ ├── userService.ts
│ │ │ ├── noteService.ts
│ │ │ ├── listService.ts
│ │ │ └── tagService.ts
│ │ ├── utils/
│ │ │ └── params.ts # Shared numeric param parsing helpers
│ │ └── index.ts # Entry point — middleware, route registration, app.listen
│ ├── schema.sql # Idempotent DDL — drop/recreate all tables and triggers
│ ├── package.json
│ └── tsconfig.json
├── src/ # Frontend (React + Vite)
│ ├── App.tsx
│ └── main.tsx
├── docs/ # Learning notes — not part of the app
├── index.html
└── package.json # Frontend package

```

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

| Method | Endpoint         | Body                            | Description                                 |
| ------ | ---------------- | ------------------------------- | ------------------------------------------- |
| `POST` | `/api/users`     | `{ name, email, password }`     | Register a new user                         |
| `GET`  | `/api/users`     | —                               | All users (passwords excluded)              |
| `POST` | `/api/login`     | `{ email, password }`           | Login — returns JWT                         |
| `PUT`  | `/api/notes/:id` | `{ title?, content?, pinned? }` | Update a note (at least one field required) |
| `GET`  | `/health`        | —                               | Health check                                |

### Protected Routes

Requires header: `Authorization: Bearer <token>`

#### Notes

| Method   | Endpoint         | Body                            | Description                                |
| -------- | ---------------- | ------------------------------- | ------------------------------------------ |
| `GET`    | `/api/notes`     | —                               | All notes (supports `?list_id`, `?search`) |
| `GET`    | `/api/notes/:id` | —                               | Single note                                |
| `POST`   | `/api/notes`     | `{ title, content?, list_id? }` | Create a note                              |
| `PUT`    | `/api/notes/:id` | `{ title?, content?, pinned? }` | Update a note (at least one field)         |
| `DELETE` | `/api/notes/:id` | —                               | Delete a note                              |

#### Lists

| Method   | Endpoint               | Body                              | Description                        |
| -------- | ---------------------- | --------------------------------- | ---------------------------------- |
| `GET`    | `/api/lists`           | —                                 | All lists for user                 |
| `GET`    | `/api/lists/:id`       | —                                 | Single list                        |
| `GET`    | `/api/lists/:id/notes` | —                                 | Notes belonging to a list          |
| `POST`   | `/api/lists`           | `{ name, description?, color? }`  | Create a list                      |
| `PUT`    | `/api/lists/:id`       | `{ name?, description?, color? }` | Update a list (at least one field) |
| `DELETE` | `/api/lists/:id`       | —                                 | Delete a list                      |

#### Tags

| Method   | Endpoint                         | Body           | Description          |
| -------- | -------------------------------- | -------------- | -------------------- |
| `GET`    | `/api/tags`                      | —              | All tags for user    |
| `POST`   | `/api/tags`                      | `{ tag_name }` | Create a tag         |
| `PUT`    | `/api/tags/:id`                  | `{ tag_name }` | Rename a tag         |
| `DELETE` | `/api/tags/:id`                  | —              | Delete a tag         |
| `GET`    | `/api/notes/:noteId/tags`        | —              | Tags on a note       |
| `POST`   | `/api/notes/:noteId/tags/:tagId` | —              | Attach tag to note   |
| `DELETE` | `/api/notes/:noteId/tags/:tagId` | —              | Detach tag from note |

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
- Deleting a list removes the junction link; the note survives unfiled (ON DELETE CASCADE on note_lists)
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
