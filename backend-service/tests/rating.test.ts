import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { getDb } from '../src/services/mongoClient';

describe('PATCH /api/v1/queries/:id/rating', () => {
  it('updates rating with valid value and rejects invalid', async () => {
    const db = await getDb();
    const q = await db.collection('queries').insertOne({
      question: 'Rate me',
      normalized_question: 'rate me',
      retrieval_time_ms: 1,
      gen_time_ms: 2,
      total_time_ms: 3,
      top_sources: [],
      citations: [],
      sources_used: [],
      confidence: 0.8,
      created_at: new Date(),
    });
    const id = String(q.insertedId);

    const okRes = await (request(app) as any)
      .patch(`/api/v1/queries/${id}/rating`)
      .send({ rating: 4 });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.rating).toBe(4);

    const badRes = await (request(app) as any)
      .patch(`/api/v1/queries/${id}/rating`)
      .send({ rating: 6 });
    expect(badRes.status).toBe(400);

    const badIdRes = await (request(app) as any)
      .patch(`/api/v1/queries/invalid/rating`)
      .send({ rating: 3 });
    expect(badIdRes.status).toBe(400);
  });
});
