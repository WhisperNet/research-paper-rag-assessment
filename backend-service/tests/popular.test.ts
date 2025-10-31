import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { getDb } from '../src/services/mongoClient';

describe('GET /api/v1/analytics/popular', () => {
  it('returns top questions and top papers', async () => {
    const db = await getDb();
    // Seed two papers
    const p1 = await db.collection('papers').insertOne({
      filename: 'p1.pdf',
      metadata: { title: 'Paper One' },
    });
    const p2 = await db.collection('papers').insertOne({
      filename: 'p2.pdf',
      metadata: { title: 'Paper Two' },
    });

    // Seed queries referencing papers
    await db.collection('queries').insertMany([
      {
        question: 'What is A?',
        normalized_question: 'what is a?',
        retrieval_time_ms: 1,
        gen_time_ms: 2,
        total_time_ms: 3,
        top_sources: [
          {
            paper_id: String(p1.insertedId),
            section: 'Intro',
            page: 1,
            score: 0.9,
          },
        ],
        citations: [],
        sources_used: [],
        confidence: 0.8,
        created_at: new Date(),
      },
      {
        question: 'What is A?',
        normalized_question: 'what is a?',
        retrieval_time_ms: 1,
        gen_time_ms: 2,
        total_time_ms: 3,
        top_sources: [
          {
            paper_id: String(p1.insertedId),
            section: 'Intro',
            page: 2,
            score: 0.8,
          },
        ],
        citations: [],
        sources_used: [],
        confidence: 0.7,
        created_at: new Date(),
      },
      {
        question: 'Explain B',
        normalized_question: 'explain b',
        retrieval_time_ms: 1,
        gen_time_ms: 2,
        total_time_ms: 3,
        top_sources: [
          {
            paper_id: String(p2.insertedId),
            section: 'Methods',
            page: 3,
            score: 0.7,
          },
        ],
        citations: [],
        sources_used: [],
        confidence: 0.9,
        created_at: new Date(),
      },
    ]);

    const res = await (request(app) as any).get('/api/v1/analytics/popular');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { top_questions, top_papers } = res.body.data;
    expect(Array.isArray(top_questions)).toBe(true);
    expect(Array.isArray(top_papers)).toBe(true);
    expect(
      top_questions.find((q: any) =>
        q.question.toLowerCase().includes('what is a')
      )
    ).toBeDefined();
    expect(
      top_papers.find((p: any) => p.paper_title === 'Paper One')
    ).toBeDefined();
  });
});
