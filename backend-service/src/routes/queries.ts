import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { ok } from '../utils/http';
import { getDb } from '../services/mongoClient';
import { ratingSchema, objectIdSchema } from '../schemas/validation';

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
    const id = objectIdSchema.parse(req.params.id);
    const { rating } = ratingSchema.parse(req.body);

    const objectId = new ObjectId(id);

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
    if (e.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: e.errors[0].message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'rating failed' },
    });
  }
});

export default router;
