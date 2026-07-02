import { Response } from 'express';
import {AuthenticatedRequest} from '../models/types'
import {getNotesForUser,
    createNote,
    updateNote,
    deleteNote,
} from '../services/noteService';

export const getNotes = async(
    req: AuthenticatedRequest,
    res: Response
) : Promise<void> => {
    try{
        const { list_id, search } = req.query;
        const notes = await getNotesForUser(req.userId as number, {
            listId: typeof list_id === 'string' ? list_id : undefined,
            search: typeof search === 'string' ? search : undefined,
        });
        res.json(notes);
    } catch (err) {
        res.
        status(500)
        .json({ error: err instanceof Error ? err.message : 'Database error'});
    }
};

export const postNote = async (
    req: AuthenticatedRequest,
    res: Response
) : Promise<void> => {
    const {title, content, list_id} = req.body;

    if(!title){
        res.status(400).json({error: 'title is required'});
        return;
    }

    try{
        const newNote = await createNote(req.userId as number, title, content, list_id);
        res.status(201).json(newNote);
    } catch(err){
        res.status(400).json({error: err instanceof Error ? err.message : 'Database error'});
    }
};

export const putNote = async (
    req: AuthenticatedRequest,
    res: Response
) : Promise<void> =>{
    const noteId = req.params.id as string;
    const {title, content } = req.body;

    try{
        //updateNote returns null if no row matched note_id AND user_id
        // either the note doesnt exist or it belongs to someone else
        // Dont distinguish either in the response so a user cant probe which note ids exist.
        const updated = await updateNote(req.userId as number, noteId, title, content);
        if(!updated){
            res.status(404).json({error: 'Note not found or unauthorized'});
            return;
        }
        res.json(updated);
    } catch(err){
        res
        .status(500)
        .json({error: err instanceof Error ? err.message : 'Database error'});
    }
};

export const deleteNoteHandler = async (
    req: AuthenticatedRequest,
    res: Response
) : Promise<void> => {
    const noteId = req.params.id as string;

    try{
        const wasDeleted = await deleteNote(req.userId as number, noteId);
        if(!wasDeleted){
            res.status(404).json({ error: 'Note not found or unauthorized'});
            return;
        } 
        res.status(200).json({message: 'Note deleted successfully'});
    } catch (err) {
        res.status(500).json({error: err instanceof Error ? err.message : 'Database error'});
    }
};