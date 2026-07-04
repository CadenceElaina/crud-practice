import { Response } from 'express';
import { AuthenticatedRequest } from '../models/types';
import { parseNumericParam, getValidIdParam } from '../utils/params';
import {
    getNotesForUser,
    getNoteById,
    createNote,
    updateNote,
    deleteNote,
} from '../services/noteService';

export const getNotes = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { list_id, search, limit, offset } = req.query;

        const parsedLimit = limit !== undefined ? parseNumericParam(limit) : undefined;
        const parsedOffset = offset !== undefined ? parseNumericParam(offset) : undefined;
        const parsedListId = list_id !== undefined
            ? parseNumericParam(list_id)
            : undefined;

        const notes = await getNotesForUser(req.userId as number, {
            listId: parsedListId,
            search: typeof search === 'string' ? search : undefined,
            limit: parsedLimit,
            offset: parsedOffset,
        });
        res.json(notes);
    } catch (err) {
        const isValidationError = err instanceof Error && err.message === 'Invalid';
        res
            .status(isValidationError ? 400 : 500)
            .json({ error: isValidationError ? 'Invalid list_id format. Must be an integer.' : 'Database error' });
    }
};

export const getNoteHandler = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const numericNoteId = getValidIdParam(res, req.params.id);
    if (numericNoteId === null) return;

    try {
        const note = await getNoteById(req.userId as number, numericNoteId);
        if (!note) {
            res.status(404).json({ error: 'Note not found or unauthorized' });
            return;
        }
        res.json(note);
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
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

    const { title, content, pinned } = req.body;

    if (title === undefined && content === undefined && pinned === undefined) {
        res.status(400).json({ error: 'At least one of title or content must be provided.' });
        return;
    }

    try {
        // Returns null when no row matched note_id + user_id.
        // A single 404 covers both "not found" and "belongs to someone else"
        // so callers cannot probe which note IDs exist.
        const updated = await updateNote(req.userId as number, numericNoteId, title, content, pinned);
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