import {Router} from 'express';
import { authenticateToken } from '../middleware/auth';
import {
    getTags,
    postTag,
    putTag,
    deleteTagHandler,
    postTagOnNote,
    deleteTagFromNote,
    getTagsOnNote,
} from '../controllers/tagController';

const router = Router();

router.use(authenticateToken);

// Tag CRUD
router.get('/tags', getTags);
router.post('/tags', postTag);
router.put('/tags/:id', putTag);
router.delete('/tags/:id', deleteTagHandler);

// Note <---> Tag junction - nested under notes so the URL reads naturally:
// Tags belonging to note 5 for example
router.get('/notes/:noteId/tags', getTagsOnNote);
router.post('/notes/:noteId/tags/:tagId', postTagOnNote);
router.delete('/notes/:noteId/tags/:tagId', deleteTagFromNote);

export default router;