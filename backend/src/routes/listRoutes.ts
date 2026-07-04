import {Router} from 'express';
import { authenticateToken } from '../middleware/auth';
import {
    getLists,
    getNotesFromList,
    getListHandler,
    postList,
    putList,
    deleteListHandler
} from '../controllers/listController'

const router = Router();

router.use(authenticateToken);

router.get('/lists', getLists);
router.get('/lists/:id/notes', getNotesFromList);
router.get('/lists/:id', getListHandler);
router.post('/lists', postList);
router.put('/lists/:id', putList);
router.delete('/lists/:id', deleteListHandler);

export default router;