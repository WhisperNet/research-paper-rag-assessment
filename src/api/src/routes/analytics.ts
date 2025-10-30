import { Router } from 'express';
import { ok } from '../utils/http';
import { aggregatePopular } from '../services/analytics';

const router = Router();

router.get('/popular', async (req: any, res: any) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
    const data = await aggregatePopular(limit);
    ok(res, data);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'popular failed' },
    });
  }
});

// keep placeholder for future analytics endpoints

export default router;
