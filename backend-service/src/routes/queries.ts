import { Router } from 'express';
import { ok } from '../utils/http';
import { getDb } from '../services/mongoClient';

const router = Router();

router.get('/history', async (req: any, res: any) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const db = await getDb();
    const cursor = db
      .collection('queries')
      .find(
        {},
        {
          projection: {
            question: 1,
            paper_ids: 1,
            retrieval_time_ms: 1,
            gen_time_ms: 1,
            total_time_ms: 1,
            confidence: 1,
            created_at: 1,
            answer: 1,
            rating: 1,
          },
        }
      )
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit);

    const items = await cursor.toArray();
    ok(res, { items });
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'history failed' },
    });
  }
});

router.patch('/:id/rating', async (req: any, res: any) => {
  try {
    const id = req.params.id;
    let objectId: any;
    try {
      objectId = new (await import('mongodb')).ObjectId(id);
    } catch {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'invalid id' },
      });
    }

    const rating = Number((req.body || {}).rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'rating must be 1-5' },
      });
    }

    const db = await getDb();
    const result = await db
      .collection('queries')
      .updateOne({ _id: objectId }, { $set: { rating } });
    if (!result.matchedCount) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'query not found' },
      });
    }
    ok(res, { id, rating });
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'rating failed' },
    });
  }
});

export default router;
