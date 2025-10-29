import { Router } from 'express';
import { notImplemented } from '../utils/http';

const router = Router();

router.get('/', (req: any, res: any) => notImplemented(res));
router.get('/:id', (req: any, res: any) => notImplemented(res));
router.delete('/:id', (req: any, res: any) => notImplemented(res));
router.get('/:id/stats', (req: any, res: any) => notImplemented(res));

export default router;
