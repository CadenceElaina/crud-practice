import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Separate pool for test setup operations (TRUNCATE, schema runs)
// Points at notesdb_test via the env vars set in env.ts
const testPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
});

const schemaPath = path.join(__dirname, '../../../schema.sql');

/** Drops and recreates all tables. Run once in beforeAll. */
export const setupTestDb = async (): Promise<void> => {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await testPool.query(schema);
};

/** Wipes all rows between tests - faster than re-running the schema. */
export const clearTables = async (): Promise<void> => {
    //CASCADE handles FK order automatically
    await testPool.query('TRUNCATE TABLE note_tags, note_lists, notes, tags, lists, users CASCADE');
};

/** Call in afterAll to prevent Jest open handle warnings. */
export const closeTestDb = async (): Promise<void> => {
    await testPool.end();
};
