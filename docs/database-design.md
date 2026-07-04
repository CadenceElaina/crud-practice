# Database Architecture & Concepts

## 1. Local Environment Setup (CLI Commands)

> terminal/bash uses `#` for comments — psql uses `--`

```bash
# Check if PostgreSQL is running and accepting connections
pg_isready

# Create a new database from the terminal
sudo -u postgres createdb name_of_db

# Create a new database user interactively
sudo -u postgres createuser --interactive

# Connect to your database via the psql CLI tool
psql name_of_db

# Execute the schema initialization script
psql -d name_of_db -f parent_dir/file_name.sql
psql -d notesdb -f backend/schema.sql
```

## 2. Structural Guardrails & Normalization

### ACID Properties

|       | Property    | Meaning                                                        |
| ----- | ----------- | -------------------------------------------------------------- |
| **A** | Atomicity   | Transactions are all-or-nothing                                |
| **C** | Consistency | Valid DB state → valid DB state                                |
| **I** | Isolation   | Transactions do not affect each other                          |
| **D** | Durability  | Permanent changes after commit — data survives server restarts |

While PostgreSQL supports storing arrays (`TEXT[]`), doing so violates [First Normal Form (1NF)](https://en.wikipedia.org/wiki/First_normal_form).

Using a `note_tags` junction table ensures **referential integrity** and prevents duplicate associations via a composite Primary Key `PRIMARY KEY (note_id, tag_id)`.

<!-- CORRECTED: "strict data atomicity" → "referential integrity"
     Atomicity is a transaction property (all-or-nothing commits).
     What the junction table provides is referential integrity — the DB
     enforces that relationships are valid and non-duplicate. -->

### Cascades vs. Nullification

- **Notes & Lists** — a note is an independent object. When a parent list is deleted, the note survives with `list_id = NULL` via `ON DELETE SET NULL`
- **Note Tags** — a row in `note_tags` has zero identity without its parents. If a note or tag is deleted, the bridge row is dropped via `ON DELETE CASCADE`

## 3. BEFORE UPDATE Trigger Mechanics

Tracks row updates without manual timestamp handling. The schema intercepts operations in memory before writing to disk.

```
UPDATE
  → Postgres builds new row in memory
  → BEFORE UPDATE trigger fires
  → Overwrites NEW.updated_at = NOW()
  → Modified row written to DISK
  → Transaction committed permanently
```

> `NEW` isn't just the `updated_at` field — it's the entire row as it will exist after the write. The trigger overwrites one field on it before returning it.
