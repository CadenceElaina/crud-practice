cascade runs parent -> child, never child -> parent
if you have note_lists as the child - it has FK cols pointing UP to the parents, notes and lists.
-Delete a row from notes (delete note) -> postgres looks at note_lists finding any rows referencing that note_id and deletes those link rows too
-Delete a row from lists (list gets deleted) -> same thing but rows are referncing list_id

-- Postgres uses B-Tree by default for indexes
-- allocates a separate chunk of disk storage for idx_note_tags_tag_id
-- scans the note_tags table and extracts every tag_id and piars it with a pointer called a TID or Tuple ID telling Postgres where the row lives on the disk
-- organizes these pairs into a B-Tree Structure sorted by tag_id
-- having a strictly sorted order via a B-Tree enables exact lookups and range scans
-- single node in the tree can have hundreds of children (keys) - prevents tree depth from going too long  
Index types in Postgres by default are B-tree - a sorted, branching structure, not a hash table. Hashtable only handles exact look ups whereas a B-tree handles exact lookups and range queries (WHERE tag_id > 5 ORDER BY etc.) - does so efficiently bc the entries are kept in sorted order.

PSQL SHELL
\dt lists all tables in a db

---

-- Create the authors table
CREATE TABLE author (
author_id SERIAL PRIMARY KEY,
name VARCHAR(50),
-- TODO: Add settings or auth fields here later if needed
created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE notes(
PK: note_id int,
author varchar(50),
title varchar(50),
body varchar(100000) ? or idk what limit should be tbh,
tags varchar(),
FK: (list_id),
created at
updated at
)

---

---

-- TIME STAMP TRIGGER - updated_at changes automatically whenever a note is edited:
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;

$$
language 'plpsql';

CREATE TRIGGER update_notes_modtime
BEFORE UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- create independent tables (no FKs)
CREATE TABLE author(
author_id SERIAL PRIMARY KEY,
name VARCHAR(50),
--settings?
created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lists(
list_id SERIAL PRIMARY KEY,
name VARCHAR(50) NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW() -- MYSQL TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
tag_id SERIAL PRIMARY KEY,
tag_name VARCHAR(30) NOT NULL UNIQUE
);

-- create dependent tables (with FKs)

CREATE TABLE notes (
note_id SERIAL PRIMARY KEY, --(mysql INT AUTO_INCREMENT replaces SERIAL)
author_id INT REFERENCES author(author_id) ON DELETE SET NULL,
title VARCHAR(100) NOT NULL,
content TEXT,
list_id INT REFERENCES list(list_id) ON DELETE SET NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
--FOREIGN KEY (list_id) REFERENCES lists(list_id) ON DELETE SET NULL
--FOREGIN KEY (author_id) REFERENCES author(author_id)
);

-- create the junction table (cardinality: many-to-many)
-- junction table
CREATE TABLE note_tags(
note_id INT REFERENCES notes(note_id) ON DELETE CASCADE,
tag_id INT REFERENCES tags(tag_id) ON DELETE CASCADE,
PRIMARY KEY (note_id, tag_id),
);
$$
