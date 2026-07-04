import { Response } from 'express';

export const parseNumericParam = (param: unknown): number => {
    const n = parseInt(String(param), 10);
    if(isNaN(n)) throw new Error('Invalid');
    return n;
}

export const getValidIdParam = (res: Response, param: unknown): number | null => {
    try{
        return parseNumericParam(param);
    } catch{
        res.status(400).json({ error: 'Invalid ID format. Must be an integer.'});
        return null;
    }
};