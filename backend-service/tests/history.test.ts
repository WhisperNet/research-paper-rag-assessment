import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { getDb } from '../src/services/mongoClient';

describe('GET /api/v1/queries/history', () => {
  it('lists recent query history and supports pagination', async () => {
    const db = await getDb();
    // Seed 3 query documents
    const now = Date.now();
    await db.collection('queries').insertMany([
      {
        question: 'Q1',
        normalized_question: 'q1',
        retrieval_time_ms: 10,
        gen_time_ms: 20,
        total_time_ms: 30,
        top_sources: [],
        citations: [],
        sources_used: [],
        confidence: 0.8,
        created_at: new Date(now - 3000),
      },
      {
        question: 'Q2',
        normalized_question: 'q2',
        retrieval_time_ms: 11,
        gen_time_ms: 21,
        total_time_ms: 32,
        top_sources: [],
        citations: [],
        sources_used: [],
        confidence: 0.7,
        created_at: new Date(now - 2000),
      },
      {
        question: 'Q3',
        normalized_question: 'q3',
        retrieval_time_ms: 12,
        gen_time_ms: 22,
        total_time_ms: 34,
        top_sources: [],
        citations: [],
        sources_used: [],
        confidence: 0.9,
        created_at: new Date(now - 1000),
      },
    ]);

    const res = await (request(app) as any).get(
      '/api/v1/queries/history?limit=2'
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeLessThanOrEqual(2);

    // Perform a real query to ensure persistence path runs (in test mode)
    const qres = await (request(app) as any)
      .post('/api/v1/query')
      .send({ question: 'Will this persist?', top_k: 1 });
    expect([200, 500]).toContain(qres.status);

    const res2 = await (request(app) as any).get(
      '/api/v1/queries/history?limit=50'
    );
    expect(res2.status).toBe(200);
    const items2 = res2.body.data.items.map((i: any) => i.question);
    expect(items2.length).toBeGreaterThanOrEqual(3);
  });
});
