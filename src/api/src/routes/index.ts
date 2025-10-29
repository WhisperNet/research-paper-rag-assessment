import { Router } from 'express';
import papers from './papers';
import query from './query';
import analytics from './analytics';

const router = Router();

router.use('/papers', papers);
router.use('/query', query);
router.use('/analytics', analytics);

export default router;
