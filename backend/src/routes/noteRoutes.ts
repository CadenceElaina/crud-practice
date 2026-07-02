import {Router} from 'express';
import {authenticateToken} from '../middleware/auth';
import {getNotes,
    postNote,
    putNote,
    deleteNoteHandler,
} from '../controllers/noteController';

const router = Router();

// Applied once, at the router level, instead of repeating
// `authenticateToken` on every single route below - every /api/notes/*
// rout requires a valid JWT.

router.use(authenticateToken);

router.get('/notes', getNotes);
router.post('/notes', postNote);
router.put('/notes/:id', putNote);
router.delete('/notes/:id', deleteNoteHandler);

export default router;