import { Router } from 'express';
import { notImplemented } from '../utils/http';

const router = Router();

router.get('/popular', (req: any, res: any) => notImplemented(res));
router.get('/history', (req: any, res: any) => notImplemented(res));

export default router;
