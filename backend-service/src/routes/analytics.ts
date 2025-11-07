import { Router } from 'express';
import { ok } from '../utils/http';
import { aggregatePopular } from '../services/analytics';
import { getPopularTopicInsight } from '../services/popularTopics';
import { getRedis } from '../services/redisClient';

const router = Router();

router.get('/top-questions', async (req: any, res: any) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
    const data = await aggregatePopular(limit);
    ok(res, data);
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'ranking failed' },
    });
  }
});

router.get('/popular', async (req: any, res: any) => {
  try {
    const redis = getRedis();
    const cacheKey = 'popular:topic:latest';

    // Check cache first (cache for 5 minutes to reduce AI load)
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return ok(res, parsed);
    }

    // Generate popular topic insight
    const result = await getPopularTopicInsight();

    // Cache the result
    await redis.setex(cacheKey, 300, JSON.stringify(result)); // 5 min cache

    ok(res, result);
  } catch (e: any) {
    // Handle specific error cases
    if (e.message === 'No questions found in database') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_DATA',
          message: 'No questions available for analysis',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL',
        message: e?.message || 'Failed to generate popular topic insight',
      },
    });
  }
});

export default router;
