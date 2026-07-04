import { pool } from '../config/db';
import { Note } from '../models/types';

interface NoteFilters {
    // Explicit `| undefined` required because tsconfig has exactOptionalPropertyTypes enabled.
    listId?: number | undefined;
    search?: string | undefined;
}

/**
 * Returns notes for a user, with optional list and/or substring search filters.
 *
 * list_id lives in the note_lists junction table, so filtering by it requires a JOIN.
 * ILIKE '%term%' is a sequential-scan substring search — fine at small scale.
 * Production full-text search would use tsvector/tsquery with a GIN index.
 */
export const getNotesForUser = async (
    userId: number,
    filters: NoteFilters
): Promise<Note[]> => {
    const conditions: string[] = ['n.user_id = $1'];
    const values: unknown[] = [userId];
    // DISTINCT prevents duplicate rows when a note belongs to multiple lists.
    let query = 'SELECT DISTINCT n.* FROM notes n';

    if (filters.listId) {
        query += ' JOIN note_lists nl ON nl.note_id = n.note_id';
        values.push(filters.listId);
        // values.push() returns the new array length, which equals the $N index of this value.
        conditions.push(`nl.list_id = $${values.length}`);
    }

    if (filters.search) {
        values.push(`%${filters.search}%`);
        // Parens required — AND binds tighter than OR, so without them a combined
        // list_id + search query would produce incorrect results.
        conditions.push(
            `(n.title ILIKE $${values.length} OR n.content ILIKE $${values.length})`
        );
    }

    query += ` WHERE ${conditions.join(' AND ')} ORDER BY n.created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
};

/**
 * Creates a note and optionally links it to a list in a single transaction.
 *
 * pool.query() borrows a connection per call, so BEGIN/INSERT/COMMIT could land
 * on three different connections. pool.connect() holds one connection for the
 * entire transaction; finally{} ensures it is always returned to the pool.
 */
export const createNote = async (
    userId: number,
    title: string,
    content: string | undefined,
    listId?: number
): Promise<Note> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // RETURNING * gives back the inserted row with all DB-applied defaults.
        const noteResult = await client.query(
            'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
            [userId, title, content ?? null]
        );
        const newNote = noteResult.rows[0];

        if (listId) {
            await client.query(
                'INSERT INTO note_lists (note_id, list_id) VALUES ($1, $2)',
                [newNote.note_id, listId]
            );
        }

        await client.query('COMMIT');
        return newNote;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Partially updates a note's title and/or content.
 * Only provided fields are written; omitting a field leaves it unchanged.
 * Returns null when no row matched note_id + user_id (not found or unauthorized).
 */
export const updateNote = async (
    userId: number,
    noteId: number,
    title: string | undefined,
    content: string | undefined
): Promise<Note | null> => {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (title !== undefined)   { fields.push(`title = $${values.push(title)}`); }
    if (content !== undefined) { fields.push(`content = $${values.push(content)}`); }

    // Nothing to update — return null so the controller can respond with 400.
    if (fields.length === 0) return null;

    values.push(noteId, userId);
    const noteIdIdx = values.length - 1;
    const userIdIdx = values.length;

    const result = await pool.query(
        `UPDATE notes SET ${fields.join(', ')} WHERE note_id = $${noteIdIdx} AND user_id = $${userIdIdx} RETURNING *`,
        values
    );
    return result.rows[0] ?? null;
};

/**
 * Deletes a note owned by the user. Returns false when nothing was deleted.
 */
export const deleteNote = async (
    userId: number,
    noteId: number
): Promise<boolean> => {
    const result = await pool.query(
        'DELETE FROM notes WHERE note_id = $1 AND user_id = $2',
        [noteId, userId]
    );
    return (result.rowCount ?? 0) > 0;
};