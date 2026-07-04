import { pool } from '../config/db';
import { Tag } from '../models/types';

/**
 * Returns all tags belonging to a user.
 */
export const getTagsForUser = async (userId: number): Promise<Tag[]> =>{
    const result = await pool.query(
        'SELECT * FROM tags WHERE user_id = $1 ORDER BY tag_name ASC',
        [userId]
    ); 
    return result.rows;
};

/**
 * Creates a tag for a user.
 * tag_name has a UNIQUE(user_id, tag_name) constraint in schema
 * The controller catches error code 23505 and returns 409 instead of 500.
 */

export const createTag = async(
    userId: number,
    tagName: string
): Promise<Tag> =>{
     const result = await pool.query(
        'INSERT INTO tags (user_id, tag_name) VALUES ($1, $2) RETURNING *',
        [userId, tagName]
    );
    return result.rows[0];
};

/**
 * Renames a tag. Only updates fields that are provided.
 * Returns null when no row matched tag_id + user_id.
 */
export const updateTag = async(
    userId: number,
    tagId: number,
    tagName: string
): Promise<Tag | null> => {
    const result = await pool.query(
        'UPDATE tags SET tag_name = $1 WHERE tag_id = $2 AND user_id = $3 RETURNING *',
        [tagName, tagId, userId]
    );
    return result.rows[0] ?? null;
};

/**
 * Deletes a tag. Rows in note_tags are removed automatically via 
 * ON DELETE CASCADE. 
 * Returns false when no row matched.
 */
export const deleteTag = async(
    userId: number,
    tagId: number
): Promise<boolean> => {
    const result = await pool.query(
        'DELETE FROM tags WHERE tag_id = $1 AND user_id = $2',
        [tagId, userId]
    );
    return (result.rowCount ?? 0) > 0;
};

/**
 * Attaches an existing tag to a note.
 * Both note and tag must belong to the user - verified by joining on user_id.
 * The PK (note_id, tag_id) prevents duplicate links.
 * Returns false if the note or tage doesn't exist or belongs to another user.
 */
export const addTagToNote = async(
    userId: number,
    noteId: number,
    tagId: number
): Promise<boolean> =>{
    // Verify ownership of both the note and the tag before inserting the link.
    // Without this check a user could link another user's tag to their note.
    const ownershipCheck = await pool.query(
        `SELECT (SELECT 1 FROM notes WHERE note_id = $1 AND user_id = $3) AS note_ok,
        (SELECT 1 FROM tags WHERE tag_id = $2 AND user_id = $3) AS tag_ok`,
        [noteId, tagId, userId]
    );
    const {note_ok, tag_ok} = ownershipCheck.rows[0];
    if(!note_ok || !tag_ok) return false;

    await pool.query(
        // ON CONFLICT DO NOTHING is idempotent - adding a tag thats already there
        // returns success instead of a PK violation error.
        'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [noteId, tagId]
    );
    return true;
};

/**
 * Removes a tag from a note. Does not delete the tag itself.
 * Returns false when no junction row matched.
 */

export const removeTagFromNote = async (
    userId: number,
    noteId: number,
    tagId: number
): Promise<boolean> =>{
    // Join back to notes/tags to enfore ownership
    // Users cannot unlink resources they dont own by guessing IDs.
    const result = await pool.query(
        `DELETE FROM note_tags
        WHERE note_id = $1
        AND tag_id = $2
        AND EXISTS (SELECT 1 FROM notes WHERE note_id = $1 AND user_id = $3)
        AND EXISTS (SELECT 1 FROM tags WHERE tag_id = $2 AND user_id = $3)`,
        [noteId, tagId, userId]
    );
    return (result.rowCount ?? 0) > 0;
};

/**
 * Returns all tags attached to a specific note.
 */
export const getTagsForNote = async(
    userId: number,
    noteId: number
): Promise<Tag[]> =>{
    const result = await pool.query(
        `SELECT t.*
        FROM tags t
        JOIN note_tags nt ON nt.tag_id = t.tag_id
        JOIN notes n ON n.note_id = nt.note_id
        WHERE nt.note_id = $1
        AND n.user_id = $2`,
        [noteId, userId]
    );
    return result.rows;
};