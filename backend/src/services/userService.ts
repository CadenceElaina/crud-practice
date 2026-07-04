import {pool} from '../config/db'
import {PublicUser} from '../models/types';

// Pur data access: takes plain values in, returns rows out. 
// Knows nothing about HTTP, req, or res which is the controller's job.

export const getAllUsers = async () => {
    const result = await pool.query(
        'SELECT user_id, name, email, created_at FROM users'
    );
    return result.rows; // returns data, knows nothing about req/res
};

export const createUser = async(
    name: string,
    email: string,
    passwordHash: string
): Promise<PublicUser> => { // PublicUser is a type of User but omitting the password
    const result = await pool.query(
        'INSERT INTO users (name, email, password) VALUES($1, $2, $3) RETURNING name, email, created_at, updated_at, last_login',
        [name, email, passwordHash]   
    );
    return result.rows[0];
}

// Returns the password hash too - this is only ever consumed internally
// by the login controller for bcrypt.compare, never sent to a client.

export const getUserByEmail = async(
    email:string
): Promise<{ user_id: number; password: string} | null> => {
    const result = await pool.query(
        'SELECT user_id, password FROM users WHERE email = $1',
        [email]
    );
    return result.rows[0] ?? null; // single row or null
};

export const updateLastLogin = async(
    userId: number
): Promise<void> => {
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1',
        [userId,]
    );
};


