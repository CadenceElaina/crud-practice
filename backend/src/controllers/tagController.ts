import { Response } from 'express';
import { DatabaseError } from 'pg';
import { AuthenticatedRequest } from '../models/types';
import { parseNumericParam, getValidIdParam } from '../utils/params';
import {
    getTagsForUser,
    createTag,
    updateTag,
    deleteTag,
    addTagToNote,
    removeTagFromNote,
    getTagsForNote,
} from '../services/tagService';
 
export const getTags = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const tags = await getTagsForUser(req.userId as number);
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
};
 
export const postTag = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const { tag_name } = req.body;
 
    if (!tag_name || typeof tag_name !== 'string' || tag_name.trim() === '') {
        res.status(400).json({ error: 'tag_name is required' });
        return;
    }
 
    if (tag_name.trim().length > 30) {
        res.status(400).json({ error: 'tag_name must be 30 characters or fewer' });
        return;
    }
 
    try {
        const newTag = await createTag(req.userId as number, tag_name.trim());
        res.status(201).json(newTag);
    } catch (err) {
        // 23505 = unique_violation: this user already has a tag with that name.
        if (err instanceof DatabaseError && err.code === '23505') {
            res.status(409).json({ error: 'A tag with that name already exists' });
            return;
        }
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
};
 
export const putTag = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const numericTagId = getValidIdParam(res, req.params.id);
    if (numericTagId === null) return;
 
    const { tag_name } = req.body;
 
    if (!tag_name || typeof tag_name !== 'string' || tag_name.trim() === '') {
        res.status(400).json({ error: 'tag_name is required' });
        return;
    }
 
    if (tag_name.trim().length > 30) {
        res.status(400).json({ error: 'tag_name must be 30 characters or fewer' });
        return;
    }
 
    try {
        const updated = await updateTag(req.userId as number, numericTagId, tag_name.trim());
        if (!updated) {
            res.status(404).json({ error: 'Tag not found or unauthorized' });
            return;
        }
        res.json(updated);
    } catch (err) {
        if (err instanceof DatabaseError && err.code === '23505') {
            res.status(409).json({ error: 'A tag with that name already exists' });
            return;
        }
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
};

export const deleteTagHandler = async(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const numericTagId = getValidIdParam(res, req.params.id);
    if (numericTagId === null) return;
    try{
        const wasDeleted = await deleteTag(req.userId as number, numericTagId);
        if(!wasDeleted){
      res.status(404).json({ error: 'Tag not found or unauthorized' });
            return;
        }
        res.status(200).json({ message: 'Tag deleted successfully'});
    } catch(err){
             res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
}

/**
 * Note <---> Tag junction handlers
 * Placed here instead of noteController because the action is tag-centric
 */

export const postTagOnNote = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> =>{
    const numericNoteId = getValidIdParam(res, req.params.noteId);
    if(numericNoteId === null) return;
    const numericTagId = getValidIdParam(res, req.params.tagId);
    if(numericTagId === null) return;

    try{
        const ok = await addTagToNote(req.userId as number, numericNoteId, numericTagId);
        if(!ok){
            res.status(404).json({error: 'Note or tag not found or unauthorized'});
            return;
        }
        res.status(201).json({message: 'Tag added to note'});
    } catch(err){
         res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
}

export const deleteTagFromNote = async(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const numericNoteId = getValidIdParam(res, req.params.noteId);
    if(numericNoteId === null) return;

    const numericTagId = getValidIdParam(res, req.params.tagId);
    if(numericTagId === null) return;

    try{
        const ok = await removeTagFromNote(req.userId as number, numericNoteId, numericTagId);
        if(!ok){
                      res.status(404).json({ error: 'Note or tag not found or unauthorized' });
            return;
        }
        res.status(200).json({message: 'Tag removed from note'});
    } catch(err){
         res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
};

export const getTagsOnNote = async(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const numericNoteId = getValidIdParam(res, req.params.noteId);
    if(numericNoteId === null) return;
    try{
        const tags = await getTagsForNote(req.userId as number, numericNoteId);;
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Database error' });
    }
};
