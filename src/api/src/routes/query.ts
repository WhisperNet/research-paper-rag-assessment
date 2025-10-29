import { Router } from 'express';
import { ok } from '../utils/http';
import {
  retrieveFromQdrant,
  rerankBySectionWeight,
} from '../services/retrieval';
import { buildContext } from '../services/context';
import { assemblePrompt } from '../utils/prompt';
import { generateAnswer } from '../services/ollamaClient';
import { getRedis } from '../services/redisClient';

const router = Router();

router.post('/', async (req: any, res: any) => {
  const { question, top_k = 5, paper_ids } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'question is required' },
    });
  }

  const topK = Math.max(1, Math.min(Number(top_k) || 5, 10));
  const paperIds = Array.isArray(paper_ids) ? paper_ids.map(String) : undefined;

  try {
    const redis = getRedis();
    const cacheKey =
      `query:ret:${String(question).trim().toLowerCase()}:` +
      `${topK}:` +
      `${paperIds ? paperIds.join(',') : '*'}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return ok(res, parsed);
    }

    // Retrieval
    const retrieved = await retrieveFromQdrant(question, topK, paperIds);
    const reranked = rerankBySectionWeight(retrieved, topK);

    // Context assembly
    const { contextItems, citations, sourcesUsed } = await buildContext(
      reranked
    );

    // Guardrail: if context is empty, reply uncertain
    if (!contextItems.length) {
      return ok(res, {
        answer:
          'I am uncertain because the retrieved context did not cover this question.',
        citations: [],
        sources_used: [],
        confidence: 0.2,
      });
    }

    const prompt = assemblePrompt(question, contextItems);

    let answer: string;
    if (process.env.NODE_ENV === 'test') {
      // Avoid external LLM in tests
      answer = 'Test answer with citations.';
    } else {
      answer = await generateAnswer(prompt);
    }

    const confidence = Math.min(
      0.99,
      Math.max(0.2, reranked[0]?.score ? Number(reranked[0].score) : 0.5)
    );

    const responseData = {
      answer,
      citations,
      sources_used: sourcesUsed,
      confidence,
    };

    await redis.setex(cacheKey, 60, JSON.stringify(responseData));

    ok(res, responseData);
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'query failed' },
    });
  }
});

export default router;
