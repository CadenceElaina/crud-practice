import { Response } from 'express';
import { AuthenticatedRequest } from '../models/types';
import {
    getNotesForUser,
    createNote,
    updateNote,
    deleteNote,
} from '../services/noteService';

/** Parses a route/query parameter to an integer, throwing on NaN. */
const parseNumericParam = (param: unknown): number => {
    const n = parseInt(String(param), 10);
    if (isNaN(n)) throw new Error('Invalid');
    return n;
};

/** Runs parseNumericParam and writes a 400 response on failure. Returns null on failure. */
const getValidIdParam = (res: Response, param: unknown): number | null => {
    try {
        return parseNumericParam(param);
    } catch {
        res.status(400).json({ error: 'Invalid ID format. Must be an integer.' });
        return null;
    }
};

export const getNotes = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { list_id, search } = req.query;

        const parsedListId = list_id !== undefined
            ? parseNumericParam(list_id)
            : undefined;

        const notes = await getNotesForUser(req.userId as number, {
            listId: parsedListId,
            search: typeof search === 'string' ? search : undefined,
        });
        res.json(notes);
    } catch (err) {
        const isValidationError = err instanceof Error && err.message === 'Invalid';
        res
            .status(isValidationError ? 400 : 500)
            .json({ error: isValidationError ? 'Invalid list_id format. Must be an integer.' : 'Database error' });
    }
};

export const postNote = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const { title, content, list_id } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        res.status(400).json({ error: 'title is required' });
        return;
    }

    let parsedListId: number | undefined;
    if (list_id !== undefined) {
        parsedListId = getValidIdParam(res, list_id) ?? undefined;
        if (parsedListId === undefined) return;
    }

    try {
        const newNote = await createNote(req.userId as number, title.trim(), content, parsedListId);
        res.status(201).json(newNote);
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
};

export const putNote = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const numericNoteId = getValidIdParam(res, req.params.id);
    if (numericNoteId === null) return;

    const { title, content } = req.body;

    if (title === undefined && content === undefined) {
        res.status(400).json({ error: 'At least one of title or content must be provided.' });
        return;
    }

    try {
        // Returns null when no row matched note_id + user_id.
        // A single 404 covers both "not found" and "belongs to someone else"
        // so callers cannot probe which note IDs exist.
        const updated = await updateNote(req.userId as number, numericNoteId, title, content);
        if (!updated) {
            res.status(404).json({ error: 'Note not found or unauthorized' });
            return;
        }
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
};

export const deleteNoteHandler = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const numericNoteId = getValidIdParam(res, req.params.id);
    if (numericNoteId === null) return;

    try {
        const wasDeleted = await deleteNote(req.userId as number, numericNoteId);
        if (!wasDeleted) {
            res.status(404).json({ error: 'Note not found or unauthorized' });
            return;
        }
        res.status(200).json({ message: 'Note deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
};