import { config } from 'dotenv';
config({ quiet: true });

/**
 * Centralized and validated environment config.
 * 
 * Before this file, `process.env.SECRET` was read directly in two spots (index.ts to sign tokens and middlewares/auth.ts to verify them)
 * with two different fallback behaviors. That's how the auth.ts middleware ended up
 * with a hardcoded fallback secret which is a security issue. Anyone can
 * read the source and could forge a valid token if SECRET was ever unset in production.
 * 
 * Instead: read every required env var ONCE, here, and fail loudly at
 * startup if something is missing. Everything else imports the validated
 * value from this module instead of touching `process.env` directly.
 */

function requireEnv(name: string): string{
    const value = process.env[name];
    if(!value){
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
process.env.NODE_ENV = 'test';
export const JWT_SECRET = requireEnv('SECRET');
export const PORT: number = Number(process.env.PORT) || 5000;