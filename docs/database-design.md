# Database Architecture & Concepts

## 1. Local Environment Setup (CLI Commands)

terminal/bash uses # for comments but psql uses --

# Check if PostgreSQL is running and accepting connections

pg_isready

# Create a new database from the terminal

sudo -u postgres createdb name_of_db

# Create a new database user interactively

sudo -u postgres createuser --interactive

# Connect to your database via the psql CLI tool

psql name_of_db

# Execute teh schema initialization script

psql -d name_of_db -f parent_dir/file_name.sql
psql -d notesdb -f backend/schemal.sql

## 2. Structural Guardrails & Normalization

A atomicity: transactions are all or nothing
C consistency: valid db state -> valid db state
I isolation: Transactions do not affect each other
D durability: Permanent changes after commitment (data survives when server is down)

While PostgreSQL supports storing data arrays (TEXT[]) doing so violates First Normal Form (1NF)

- using a notes_tags junction table ensures strict data atomicity and prevention of duplicate associations using a composite Primary Key PRIMARY KEY (note_id, tag_id)

Cascades vs. Nullification
-Notes & Lists: A note is an independent object. When a parent list is deleted, the note survives with list_id = NULL via ON DELETE SET NULL
-Note Tags: A row in note_tags has zero identity without its parents. If a note or tag is deleted, the bridge row is no longer needed and dropped via ON DELETE CASCADE

## 3. BEFORE UDPATE Memory Mechanics

keep track of row updates w/o handling timestamps manually
schema intercepts ops directly in memory before writing to physical storage (disk).

UPDATE -> [Postgres builds new row in memory] -> [BEFORE UDPATE Trigger fires] then overwrites NEW.updated_at = NOW(); -> Modified row is written to DISK -> transaction committed permanently
