import { Request, Response} from 'express';
import { DatabaseError } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
    getAllUsers,
    createUser,
    getUserByEmail,
    updateLastLogin,
} from '../services/userService';
import {JWT_SECRET} from '../config/env';

// TODO: restrict or remove before production 
export const getUsers = async (req: Request, res: Response): Promise<void> =>{
    try{
        const users = await getAllUsers();
        res.json(users);
    } catch(err){
         res
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Database error' });
    }
};

export const registerUser = async(
    req: Request,
    res: Response
): Promise<void> => {
    const {name, email,password} = req.body;
    if (!name || !email || !password) {
          res.status(400).json({ error: 'name, email, and password are required' });
    return;
    }
    if (typeof password !== 'string' || password.length < 8) {
        res.status(400).json({error:'password must be at least 8 characters'});
    return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
}

    try{
        // Key strecthing: 2^saltRounds hashing operations - 2^10 = 1024,
        // ~100ms to hash. Slow enough to blunt some brute-force attempts, fast
        // enough that a real user signing up doesnt have major delay
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const newUser = await createUser(name, email,passwordHash);
        res.status(201).json(newUser);
    } catch(err) { 
         if (err instanceof DatabaseError && err.code === '23505'){
             res.status(409).json({error: 'Email already registered'});
          return;
         }
          res.status(500).json({error: err instanceof Error? err.message: 'Database'});
    }
};

export const loginUser = async(
    req: Request,
    res: Response
): Promise<void> => {
    const {email, password} = req.body;

    if(!email || !password){
        res.status(400).json({error: 'Email and password are required'});
        return;
    }
    try{
        const user = await getUserByEmail(email);

        if(!user){
            res.status(401).json({error: 'Invalid email or password'});
            return;
        }

        const passwordCorrect = await bcrypt.compare(password, user.password);
        if(!passwordCorrect){
            // generic message prevents user from probing if its email/password that is incorrect - prevent enumation
            res.status(401).json({error: 'Invalid email or password'});
            return;
        }

        await updateLastLogin(user.user_id);

        const token = jwt.sign({id: user.user_id}, JWT_SECRET, {
            expiresIn: '1d',
        });

        res.status(200).json({
            token,
            user: {id: user.user_id, email},
        });
    } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Database error' });
  }
};