//db queries
import {pool} from '../config/db';
import {Note} from '../models/types';

interface NoteFilters{
    /**
     * `| undefined` is spelled out explicitly (not just `listId?:`) because
     * tsconfig has exactOptionalPropertyTypes on - that flag means an optional
     * property can be OMITTED or be its type, but assigning the literal
     * value `undefined` to it is a type error unless undefined is part of
     * the declared type. The controller buidls this object conditionally and
     * may explcitly pass `undefined`, so we declare for it.
     */
    listId?: string | undefined;
    search?: string | undefined;
}

/**
 * Builds the WHERE clause dynamically based on which filters are passed,
 * matching the query params documented in the README:
 * ?list_id=3                   Filter by list
 * ?search=keyword              Search title and content
 * ?list_id=3&search=keyword    Combined
 * 
 * list_id lives in the notes_lists junction table, not on notes itself
 * (see schema.sql), so filtering by it requries a join.
 * 
 * NOTE: ILIKE `%term$` is a simple, substring search. It can't use
 * a normal B-tree index (it'll table-scan), which is fine at small
 * scales. A real "full-text search" - the kind suggested in the README
 * would use Postgres's tsvector/tsquery within a GIN index instead.
 * Thats a documented gap, not implemented here.
 */

export const getNotesForUser = async(
    userId: number,
    filters: NoteFilters
): Promise<Note[]> => {
    const conditions: string[] = ['n.user_id = $1'];
    const values: unknown[] = [userId];
    let query = 'SELECT DISTINCT n.* FROM notes n'; // get unique values of n.(attribute(s)) from our notes table aliased n

    if(filters.listId) {
        query += ' JOIN note_lists nl ON nl.note_id = n.note_id'; // if we include a list in the filter we should join the note lists table with the notes table on the PK note_id so taht we can access the users lists
        values.push(filters.listId);
        conditions.push(`nl.list_id = $${values.length}`); // not sure why the length of values = our list_id we want
        // ig $1 is a variable passed in the req and we want the one of values.length to id which value represents the list_id we need
    }

    if(filters.search){
        values.push(`%{filters.search}%`);
        conditions.push(
            `n.title ILIKE $${values.length} OR n.content ILIKE $${values.length}`
        );
    }

    query += ` WHERE ${conditions.join(' AND ')} ORDER BY n.created_at DESC`; // combine filters/search and order by most recent

    const result = await pool.query(query,values);
    return result.rows;
}
// Do we allow for ordering by asc? oldest? or last modified or variants?

/**
 * Creates a note and, optionally, links it to a list inside ONE transaction on ONE dedicated connection.
 * 
 * Each `pool.query(...)` calls does NOT give you a transaction.
 * Each `pool.query()` call checks a client out of the pool, runs
 * ONE query, and returns it - so that BEGIN, the INSERT, and COMMIT
 * can each land on a different physical connection.
 * 
 * Check out a single client with `pool.connect()`, run every statement
 * in the transaction on THAT client, then release it back to the pool
 * in a `finally` so it's returned even if something throws an error.
 */

export const createNote = async(
    userId: number,
    title: string,
    content: string,
    listId?: number
): Promise<Note> =>{
    const client = await pool.connect();
    try{
        await client.query('BEGIN');

        const noteResult = await client.query(
            'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
            [userId, title, content] // this is whats returned or * is all rows? idk what this syntax istbh
        );
        const newNote = noteResult.rows[0];

        if(listId){
            await client.query(
                'INSERT INTO note_lists (note_id, list_id) VALUES ($1, $2)',
                [newNote.note_id, listId]
            );
        }

        await client.query('COMMIT');
        return newNote;
    } catch(err){
        await client.query('ROLLBACK') //ACID
        throw err;
    } finally{
        client.release();
    }
};

export const updateNote = async(
    userId: string,
    noteId: string,
    title: string,
    content: string
): Promise<Note | null> =>{
    const result = await pool.query(
        'UPDATE notes SET ttile = $1, content = $2 WHERE note_id = $3 AND user_id = $4 RETURNING *',
        [title, content, noteId, userId]
    );
    return result.rows[0] ?? null;
};

export const deleteNote =async(
    userId: number,
    noteId: string
): Promise<boolean> =>{
    const result = await pool.query(
        'DELETE FROM notes WHERE note_id = $1 AND user_id = $2 RETURNING *',
        [noteId, userId]
    );
    return (result.rowCount ?? 0 ) > 0; // number of notes deleted?
}