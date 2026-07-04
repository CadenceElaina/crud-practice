-- Schema defines the structure
-- =========================================================================
-- WIPE THE EXISTING DATABASE STRUCTURES (Allows running the script repeatedly)
-- =========================================================================
-- Idempotent DDL (Data Definition Language) Script. idempotent: runs multiple times produces exact same results
-- DBs change - this helps so that i can just update the schema.sql file save and run psql -d notesdb -f schema.sql 
-- However, this pattern can be dangerous in production - as it wipes out existing rows on reset
-- 0001_create_initial_tables.sql -> 0002_add_email_to_author.sql -> ... n_change.sql 
DROP TRIGGER IF EXISTS update_notes_modtime ON notes;
DROP TRIGGER IF EXISTS update_lists_modtime ON lists;
DROP TRIGGER IF EXISTS update_tags_modtime ON tags;
DROP TRIGGER IF EXISTS update_users_modtime ON users;
 
DROP TABLE IF EXISTS note_tags   CASCADE;
DROP TABLE IF EXISTS note_lists  CASCADE;
DROP TABLE IF EXISTS notes       CASCADE;
DROP TABLE IF EXISTS tags        CASCADE;
DROP TABLE IF EXISTS lists       CASCADE;
DROP TABLE IF EXISTS users       CASCADE;
 
-- =========================================================================
-- 1. SHARED TRIGGER FUNCTION
-- =========================================================================
-- Overwrites updated_at on the mutated row before the write is committed.
-- RETURNS TRIGGER and the NEW/OLD variables are only valid inside trigger context.
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';
 
-- =========================================================================
-- 2. INDEPENDENT TABLES (no foreign keys)
-- =========================================================================
CREATE TABLE users (
    user_id    SERIAL PRIMARY KEY,
    name       VARCHAR(50)  NOT NULL,
    email      VARCHAR(50)  UNIQUE NOT NULL,
    password   VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT NOW(),
    updated_at TIMESTAMPTZ  DEFAULT NOW(),
    last_login TIMESTAMPTZ
);
 
-- =========================================================================
-- 3. DEPENDENT TABLES (reference users)
-- =========================================================================
CREATE TABLE notes (
    note_id    SERIAL PRIMARY KEY,
    user_id    INT          REFERENCES users(user_id) ON DELETE CASCADE,
    title      VARCHAR(100) NOT NULL,
    content    TEXT,
    created_at TIMESTAMPTZ  DEFAULT NOW(),
    updated_at TIMESTAMPTZ  DEFAULT NOW(),
    pinned     BOOLEAN      DEFAULT FALSE
);
 
CREATE TABLE lists (
    list_id    SERIAL PRIMARY KEY,
    user_id    INT         REFERENCES users(user_id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
 
CREATE TABLE tags (
    tag_id     SERIAL PRIMARY KEY,
    user_id    INT         REFERENCES users(user_id) ON DELETE CASCADE,
    tag_name   VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Tags are unique per user; the same tag name may exist across different users.
    UNIQUE (user_id, tag_name)
);
 
-- =========================================================================
-- 4. TRIGGERS (attach updated_at automation)
-- =========================================================================
CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
 
CREATE TRIGGER update_notes_modtime
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
 
CREATE TRIGGER update_lists_modtime
    BEFORE UPDATE ON lists
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
 
CREATE TRIGGER update_tags_modtime
    BEFORE UPDATE ON tags
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
 
-- =========================================================================
-- 5. JUNCTION TABLES (many-to-many relationships)
-- =========================================================================
-- Deleting either side removes the link; the note/tag itself is unaffected
-- unless its own table also has a CASCADE rule.
CREATE TABLE note_tags (
    note_id INT REFERENCES notes(note_id) ON DELETE CASCADE,
    tag_id  INT REFERENCES tags(tag_id)   ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);
 
CREATE TABLE note_lists (
    note_id INT REFERENCES notes(note_id)  ON DELETE CASCADE,
    list_id INT REFERENCES lists(list_id)  ON DELETE CASCADE,
    PRIMARY KEY (list_id, note_id)
);
 
-- =========================================================================
-- 6. INDEXES
-- =========================================================================
-- Junction table PKs cover (list_id, note_id) and (note_id, tag_id).
-- These cover the reverse-lookup direction not already served by the PK.
CREATE INDEX idx_note_tags_tag_id   ON note_tags(tag_id);
CREATE INDEX idx_note_lists_note_id ON note_lists(note_id);