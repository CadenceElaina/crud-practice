import { config } from 'dotenv';
// Load real .env for credentials (DB_USER, DB_PASSWORD, SECRET, etc.)
config({ quiet: true });

// Force test DB - overrides whatever DB_NAME is in .env
process.env.DB_NAME = 'notesdb_test';
