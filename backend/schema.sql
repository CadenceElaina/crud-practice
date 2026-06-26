
-- =========================================================================
-- 1. SETUP FUNCTIONS & TRIGGERS FIRST
-- =========================================================================

-- Create trigger function to automatically update the 'updated_at' column
-- NEW isnt just the updated_at field - its the entire row as it will exist after the write. The trigger takes the entire row object and overwrites one field on it (NEW.updated_at = NOW()) before returning it. 
-- RETURNS TRIGGER is a special pseudo-type that exists only for trigger functions. It tells Postgres "this function will be invoked by the trigger system, not called directly in a query" special vars NEW and OLD only exist inside a trigger context. 
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql'; -- Fixed typo: changed 'plpsql' to 'plpgsql'


-- =========================================================================
-- 2. CREATE INDEPENDENT TABLES (No Foreign Keys)
-- =========================================================================

-- Create the authors table
CREATE TABLE author (
    author_id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    -- TODO: Add settings or auth fields here later if needed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the lists table
CREATE TABLE lists (
    list_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the tags table
CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name VARCHAR(30) NOT NULL UNIQUE
);


-- =========================================================================
-- 3. CREATE DEPENDENT TABLES (Contains Foreign Keys)
-- =========================================================================

-- Create the notes table (Postgres uses SERIAL instead of MySQL AUTO_INCREMENT)
CREATE TABLE notes (
    note_id SERIAL PRIMARY KEY, 
    author_id INT REFERENCES author(author_id) ON DELETE SET NULL, 
    title VARCHAR(100) NOT NULL,
    content TEXT, -- Using TEXT for unlimited capacity instead of limiting to a massive VARCHAR
    list_id INT REFERENCES lists(list_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attach the timestamp trigger to the notes table
CREATE TRIGGER update_notes_modtime
BEFORE UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();


-- =========================================================================
-- 4. CREATE JUNCTION TABLES (Many-to-Many Relationships)
-- =========================================================================

-- Create the junction table to bridge notes and tags
CREATE TABLE note_tags (
    note_id INT REFERENCES notes(note_id) ON DELETE CASCADE,
    tag_id INT REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id) 
);


-----------------------------------
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
----------------------------------
# used ai to generate this but typed it out:

# TIME STAMP TRIGGER - updated_at changes automatically whenever a note is edited:
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$ language 'plpsql';

CREATE TRIGGER update_notes_modtime
BEFORE UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

# create independent tables (no FKs)
CREATE TABLE author(
author_id SERIAL PRIMARY KEY,
name VARCHAR(50),
#settings?
created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lists(
list_id SERIAL PRIMARY KEY,
name VARCHAR(50) NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW() # MYSQL TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
tag_id SERIAL PRIMARY KEY,
tag_name VARCHAR(30) NOT NULL UNIQUE
);

# create dependent tables (with FKs)

CREATE TABLE notes (
note_id SERIAL PRIMARY KEY, #(mysql INT AUTO_INCREMENT replaces SERIAL)
author_id INT REFERENCES author(author_id) ON DELETE SET NULL, 
title VARCHAR(100) NOT NULL,
content TEXT,
list_id INT REFERENCES list(list_id) ON DELETE SET NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
#FOREIGN KEY (list_id) REFERENCES lists(list_id) ON DELETE SET NULL
#FOREGIN KEY (author_id) REFERENCES author(author_id)  
);

# create the junction table (cardinality: many-to-many)
-- junction table
CREATE TABLE note_tags(
note_id INT REFERENCES notes(note_id) ON DELETE CASCADE,
tag_id INT REFERENCES tags(tag_id) ON DELETE CASCADE,
PRIMARY KEY (note_id, tag_id),
);


