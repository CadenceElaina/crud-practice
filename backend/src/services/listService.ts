import {pool} from '../config/db';
import {List} from '../models/types';

// should prob just make a filters interface and have list/notes filters extend it? 


/**
 * Gets user's list(s) based on no or combinatory filters
 */
export const getListsForUser = async(
    userId: number,
    includeArchived = false,
): Promise<List[]> => {
    const query = includeArchived
    ? 'SELECT * FROM lists WHERE user_id = $1'
    : 'SELECT * FROM lists WHERE user_id = $1 AND is_archived = FALSE';
    const result = await pool.query(query, [userId]);
    return result.rows;
}

/**
 * Get list by id
 */
export const getListById = async(
    userId: number,
    listId: number,
): Promise<List | null> => {
    const result = await pool.query(
        'SELECT * FROM lists WHERE list_id = $1 AND user_id = $2',
        [listId, userId]
    );
    return result.rows[0] ?? null;
}
/**
 * Creates a list for a user
 */
export const createList = async(
    userId: number,
    name: string,
    description: string | null,
    color: string | null
): Promise<List> => {

try{
    const result = await pool.query(
        'INSERT INTO lists (user_id, name, description, color) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, name, description ?? null, color ?? null]
    );
    return result.rows[0];

} catch(err){
throw err;
} 
}

/**
 * Renames a list
 */

export const updateList = async(
    userId: number,
    listId: number,
    name: string | undefined,
    description: string | null | undefined,
    color: string | null | undefined
): Promise<List | null> => {
    const fields: string[] = [];
    const values: unknown[] = [];

    if(name !== undefined) {fields.push(`name = $${values.push(name)}`);}
    if(description !== undefined) {fields.push(`description = $${values.push(description)}`);}
    if(color !== undefined) {fields.push(`color = $${values.push(color)}`);}

    if(fields.length==0) return null; // nothing to update

    values.push(listId, userId);
    const listIdIdx = values.length -1;
    const userIdIdx = values.length; 

    const result = await pool.query(
        `UPDATE lists SET ${fields.join(', ')} WHERE list_id = $${listIdIdx} AND user_id = $${userIdIdx} RETURNING *`,
        values
    );
    return result.rows[0] ?? null;
}

/**
 * Deletes a list 
 */

export const deleteList = async(
    userId: number,
    listId: number
): Promise<boolean> => {
    const result = await pool.query(
        'DELETE FROM lists WHERE list_id = $1 AND user_id = $2',
        [listId, userId]
    );
    return (result.rowCount ?? 0) > 0;
}

/**
 * Get notes belonging to a specific list
 */