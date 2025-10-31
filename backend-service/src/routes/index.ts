import { Router } from 'express';
import papers from './papers';
import query from './query';
import analytics from './analytics';
import queries from './queries';

const router = Router();

router.use('/papers', papers);
router.use('/query', query);
router.use('/analytics', analytics);
router.use('/queries', queries);

export default router;
