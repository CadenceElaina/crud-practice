import {Request} from 'express';

/**
 * Express's Request type has no concept of "userId" - that's something
 * OUR auth middleware adds, after verifying a JWT. Rather than mutating
 * the global Express.Request type (which would leak into every file that imports express, even ones that have nothing to do with auth),
 * we extend Request LOCALLY and use AuthenticatedRequest ONLY on routes
 * that sit behind authenticateToken.
 * Modifying Express's types injects changes like userId into every single route handler across the app. - only apply to routes requiring auth - prevents accessing it when its undefined
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
// Omit - TS utility type - creates a brand new object type by copying an existing interface and removing specific keys
// User changes -> PublicUser inherits changes without needing to be updated when User is updated

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
