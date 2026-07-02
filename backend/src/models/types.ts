import {Request} from 'express';

/**
 * Express's Request type has no concept of "userId" - that's something
 * OUR auth middleware adds, after verifying a JWT. Rather than mutating
 * the global Express.Request type (which would leak into every file that imports express, even ones that have nothing to do with auth),
 * we extend Request LOCALLY and use AuthenticatedRequest ONLY on routes
 * that sit behind authenticateToken.
 * which does..?
 */

export interface AuthenticatedRequest extends Request {
    userId?: number; // Matching SERIAL (INT) user_id from Postgres
}

export interface User{
    user_id: number;
    name: string;
    email: string;
    password: string;
    created_at: Date;
    updated_at: Date | null;
}

// The shape of a user we are allowed to send back to a client
// Specifically missing `password`. Using a derived type (Omit) instead
// of writing this out by hand means if a field is ever renamed on User,
// that this will stay in sync.
// ok but what is Omit<>;? And how does it stay in sync?

export type PublicUser = Omit<User, 'password'>;

export interface Note{
    note_id: number;
    user_id: number;
    title: string;
    content: string | null;
    created_at: Date;
    updated_at: Date;
    pinned: boolean;
}
