import request from 'supertest';
import { app } from '../../src/index';
import { setupTestDb, clearTables, closeTestDb } from './helpers/testDb';
import { closePool } from '../config/db';

beforeAll(async() => {
    await setupTestDb(); // fresh schema
});

beforeEach(async () => {
    await closeTestDb(); // close test helper pool
    await closePool(); // close app's pool
});

afterAll(async () => {
    await closeTestDb(); // close test helper pool
    await closePool(); // close app's pool
});

// ─── Register ────────────────────────────────────────────────────────────────
// const valid user = {}

// ─── Login ───────────────────────────────────────────────────────────────────

// ─── Get Users (auth protected) ──────────────────────────────────────────────
