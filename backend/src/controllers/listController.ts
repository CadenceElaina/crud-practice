import { Response } from 'express';
import { AuthenticatedRequest } from '../models/types';
import {
    getListsForUser,
    getListById,
    createList,
    updateList,
    deleteList,
} from '../services/listService'
import { getNotesForUser } from '../services/noteService';
import { getValidIdParam, parseNumericParam } from '../utils/params';

export const getLists = async(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try{
        const includeArchived = req.query.include_archived === 'true';
        const lists = await getListsForUser(req.userId as number, includeArchived);
        res.json(lists);
    } catch(err){
             const isValidationError = err instanceof Error && err.message === 'Invalid';
        res
            .status(isValidationError ? 400 : 500)
            .json({ error: isValidationError ? 'Invalid list_id format. Must be an integer.' : 'Database error' });
    }
};

export const getNotesFromList = async(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try{
        const numericListId = getValidIdParam(res, req.params.id);
        if(numericListId === null) return;

        const notes = await getNotesForUser(req.userId as number, {
            listId: numericListId,
        });

        res.json(notes);


    } catch(err){
           const isValidationError = err instanceof Error && err.message === 'Invalid';
        res
            .status(isValidationError ? 400 : 500)
            .json({ error: isValidationError ? 'Invalid list_id format. Must be an integer.' : 'Database error' });
    }
}

export const getListHandler = async(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
     const numericListId = getValidIdParam(res, req.params.id);
    if (numericListId === null) return;

        try {
        const list = await getListById(req.userId as number, numericListId);
        if (!list) {
            res.status(404).json({ error: 'Note not found or unauthorized' });
            return;
        }
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }

}

export const postList = async(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const {name, description, color} = req.body
    if(!name || typeof name !== 'string' || name.trim() === ''){
        res.status(400).json({error: 'name is required'});
        return;
    }

    try{
        const newList = await createList(req.userId as number, name.trim(), description?? null, color ?? null);
        res.status(201).json(newList);
    } catch(err){
                res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
}

export const putList = async(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const numericListId = getValidIdParam(res, req.params.id);
    if(numericListId === null) return;

    const {name, description, color} = req.body;
 if (name === undefined && description === undefined && color === undefined) {
        res.status(400).json({ error: 'At least one of title or content must be provided.' });
        return;
    }
//     if(name === undefined){
//   res.status(400).json({ error: 'Name of list must be provided.' });
//         return;
//     }

    try{
        const updated = await updateList(req.userId as number, numericListId, name, description, color);
        if(!updated){
                   res.status(404).json({ error: 'List not found or unauthorized' });
            return;
        }
        res.json(updated)
    } catch(err){
                res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
}

export const deleteListHandler = async(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const numericListId = getValidIdParam(res, req.params.id);
    if (numericListId === null) return;

    try{
        const wasDeleted = await deleteList(req.userId as number, numericListId);
        if(!wasDeleted){
                        res.status(404).json({ error: 'List not found or unauthorized' });
            return;
        }
        res.status(200).json({message: 'List deleted successfully'});
    } catch(err){
                res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
}