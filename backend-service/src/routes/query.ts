import { Router } from 'express';
import { createHash } from 'crypto';
import { ok } from '../utils/http';
import {
  retrieveFromQdrant,
  rerankBySectionWeight,
} from '../services/retrieval';
import { buildContext } from '../services/context';
import { assemblePrompt } from '../utils/prompt';
import { generateAnswer } from '../services/ollamaClient';
import { getRedis } from '../services/redisClient';
import { saveQueryHistory, normalizeQuestion } from '../services/analytics';
import { logger } from '../config/logger';
import { querySchema } from '../schemas/validation';

const router = Router();

/**
 * Generate a compact, deterministic cache key from query parameters
 * Uses SHA256 hash to avoid issues with long questions and whitespace variations
 */
function generateCacheKey(
  question: string,
  topK: number,
  paperIds?: string[]
): string {
  // Normalize the question: trim, lowercase, collapse multiple spaces
  const normalizedQuestion = question.trim().toLowerCase().replace(/\s+/g, ' ');

  // Sort paper IDs for consistency (e.g., [1,2,3] and [3,2,1] should match)
  const sortedPaperIds = paperIds ? [...paperIds].sort().join(',') : '*';

  // Create a deterministic string representation
  const cacheInput = `${normalizedQuestion}|${topK}|${sortedPaperIds}`;

  // Hash it to keep keys short and consistent
  const hash = createHash('sha256')
    .update(cacheInput)
    .digest('hex')
    .slice(0, 16);

  return `query:ret:${hash}`;
}

router.post('/', async (req: any, res: any) => {
  try {
    const validated = querySchema.parse(req.body);
    const { question, top_k = 5, paper_ids } = validated;
    const topK = top_k;
    const paperIds = paper_ids;
    const redis = getRedis();
    const cacheKey = generateCacheKey(question, topK, paperIds);

    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return ok(res, parsed);
    }

    // Retrieval
    const t0 = Date.now();
    const retrieved = await retrieveFromQdrant(question, topK, paperIds);
    const reranked = rerankBySectionWeight(retrieved, topK);
    const retrievalTimeMs = Date.now() - t0;

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
    const t1 = Date.now();
    if (process.env.NODE_ENV === 'test') {
      // Avoid external LLM in tests
      answer = 'Test answer with citations.';
    } else {
      answer = await generateAnswer(prompt);
    }
    const genTimeMs = Date.now() - t1;

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

    // Persist query history (best-effort)
    try {
      const topSources = reranked.slice(0, 5).map((r: any) => ({
        paper_id: r?.payload?.paper_id,
        section: r?.payload?.section,
        page: r?.payload?.page,
        score: r?.score,
      }));
      await saveQueryHistory({
        question,
        normalized_question: normalizeQuestion(question),
        paper_ids: paperIds,
        answer,
        retrieval_time_ms: retrievalTimeMs,
        gen_time_ms: genTimeMs,
        total_time_ms: retrievalTimeMs + genTimeMs,
        top_sources: topSources,
        citations,
        sources_used: sourcesUsed,
        confidence,
        created_at: new Date(),
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to save query history');
    }

    ok(res, responseData);
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: e.errors[0].message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'query failed' },
    });
  }
});

export default router;
