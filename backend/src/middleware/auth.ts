// =========================================================================
// TYPES & MIDDLEWARE
// =========================================================================
import { Response, NextFunction} from 'express';
import { AuthenticatedRequest } from '../models/types';
import {JWT_SECRET} from '../config/env';
import jwt from 'jsonwebtoken';

/**
 * Verifies teh `Authorization: Bearer <token>` header on protected routes.
 * On success, attaches the decoded user id to req.userId and calls next().
 * On failure, responds and returns - never calls next() with a bad token,
 * so a controller can always trust that req.userId is set if it's 
 * running at all.
 */
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token missing or invalid' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token is invalid or expired' });
    return;
  }
};

/*

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(!token){
         res.status(401).json({error: 'Access token missing or invalid'});
         return;  // explicitly return void, not the res obj
    }

    try{
        const decoded = jwt.verify(token, JWT_SECRET) as {id: number};
        req.userId = decoded.id;
        next();
    } catch (err){
         res.status(403).json({error: 'Token is invalid or expired'});
         return;
    }
};
*/