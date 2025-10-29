import { Router } from 'express';
import { notImplemented } from '../utils/http';

const router = Router();

router.post('/', (req: any, res: any) => notImplemented(res));

export default router;
