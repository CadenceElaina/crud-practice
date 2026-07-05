import request from 'supertest';
import { app } from '../../src/index';
import { setupTestDb, clearTables, closeTestDb } from './helpers/testDb';
import { closePool } from '../config/db';

beforeAll(async() => {
    await setupTestDb(); // fresh schema
});

beforeEach(async () => {
    await clearTables(); 
});

afterAll(async () => {
    await closeTestDb(); // close test helper pool
    await closePool(); // close app's pool
});

// ─── Register ────────────────────────────────────────────────────────────────
const validUser = {name: "Ada", email:"ada.lovelace@gmail.com", password:"firstnoteG"};

describe('POST /api/users', () => {
    it('201 - creates and returns public fields only', async() => {
        const res = await request(app).post('/api/users').send(validUser);
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({name: 'Ada', email:'ada.lovelace@gmail.com'});
        expect(res.body).toHaveProperty('user_id');
        expect(res.body).not.toHaveProperty('password');
    })
  it('400 — rejects missing name', async () => {
        const res = await request(app).post('/api/users')
            .send({ email: 'alice@example.com', password: 'firstnoteG' });
        expect(res.status).toBe(400);
    });
        it('400 - rejects missing email', async () => {
        const res = await request(app).post('/api/users')
        .send({name: 'Ada', password: 'firstnoteG'});
        expect(res.status).toBe(400);
    });
    it('400 - rejects missing password', async () => {
        const res = await request(app).post('/api/users')
        .send({name: 'Ada', email: 'ada.lovelace@gmail.com'});
        expect(res.status).toBe(400);
    });
    it('400 — rejects password under 8 characters', async () => {
        const res = await request(app).post('/api/users')
            .send({ name: 'Alice', email: '@ada.lovelace@gmail.com', password: 'short' });
        expect(res.status).toBe(400);
    });
            it('400 - rejects invalid email format', async () => {
        const res = await request(app).post('/api/users')
            .send({ name: 'Ada', email: 'not adas email', password: 'firstnoteG' });
        expect(res.status).toBe(400);
    });
        it('409 — rejects duplicate email', async () => {
        await request(app).post('/api/users').send(validUser);
        const res = await request(app).post('/api/users').send(validUser);
        expect(res.status).toBe(409);
    });
});// ─── Login ───────────────────────────────────────────────────────────────────

describe('POST /api/login', () => {
    // Seed a user before each login test
    beforeEach(async () => {
        await request(app).post('/api/users').send(validUser);
    });

    it('200 — returns token and user on valid credentials', async () => {
        const res = await request(app).post('/api/login')
            .send({ email: validUser.email, password: validUser.password });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toMatchObject({ email: validUser.email });
    });

    it('401 — rejects wrong password', async () => {
        const res = await request(app).post('/api/login')
            .send({ email: validUser.email, password: 'wrongpassword' });
        expect(res.status).toBe(401);
    });

    it('401 — rejects unknown email', async () => {
        const res = await request(app).post('/api/login')
            .send({ email: 'nobody@example.com', password: 'firstnoteG' });
        expect(res.status).toBe(401);
    });

    it('400 — rejects missing password', async () => {
        const res = await request(app).post('/api/login')
            .send({ email: validUser.email });
        expect(res.status).toBe(400);
    });
});

// ─── Get Users (auth protected) ──────────────────────────────────────────────

describe('GET /api/users', () => {
    it('401 — rejects request without token', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(401);
    });

    it('200 — returns user list with valid token', async () => {
        await request(app).post('/api/users').send(validUser);
        const loginRes = await request(app).post('/api/login')
            .send({ email: validUser.email, password: validUser.password });
        const token: string = loginRes.body.token;

        const res = await request(app).get('/api/users')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        // password must never appear in any returned user object
        res.body.forEach((user: Record<string, unknown>) => {
            expect(user).not.toHaveProperty('password');
        });
    });
});