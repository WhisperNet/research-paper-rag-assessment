import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { getDb } from '../src/services/mongoClient';

async function seedPaper() {
  const db = await getDb();
  const paper = await db.collection('papers').insertOne({
    filename: 'seed.pdf',
    metadata: { title: 'Seed Paper' },
    sections: [{ name: 'Intro', start_page: 1, end_page: 1 }],
    chunk_count: 2,
    status: 'indexed',
    created_at: new Date(),
    indexed_at: new Date(),
  });
  const paperId = String(paper.insertedId);
  await db.collection('chunks').insertMany([
    { paper_id: paperId, text: 'chunk a', section: 'Intro', page: 1, order: 0 },
    { paper_id: paperId, text: 'chunk b', section: 'Intro', page: 1, order: 1 },
  ]);
  return paperId;
}

describe('papers management', () => {
  it('lists papers', async () => {
    const id = await seedPaper();
    const res = await (request(app) as any).get('/api/v1/papers');
    expect(res.status).toBe(200);
    const items = res.body.data.items || [];
    expect(items.find((p: any) => p.id === id)).toBeDefined();
  });

  it('gets paper details', async () => {
    const id = await seedPaper();
    const res = await (request(app) as any).get(`/api/v1/papers/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.chunk_count).toBeGreaterThanOrEqual(2);
  });

  it('returns stats', async () => {
    const id = await seedPaper();
    const res = await (request(app) as any).get(`/api/v1/papers/${id}/stats`);
    expect(res.status).toBe(200);
    expect(res.body.data.paper_id).toBe(id);
    expect(res.body.data.chunk_count).toBeGreaterThanOrEqual(2);
    // in test mode vector_count is 0 from helper
    expect(res.body.data.vector_count).toBeTypeOf('number');
  });

  it('deletes a paper', async () => {
    const id = await seedPaper();
    const res = await (request(app) as any).delete(`/api/v1/papers/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.removed_paper).toBe(true);
    // check gone
    const res2 = await (request(app) as any).get(`/api/v1/papers/${id}`);
    expect(res2.status).toBe(404);
  });

  it('handles invalid id', async () => {
    const res = await (request(app) as any).get('/api/v1/papers/invalid');
    expect(res.status).toBe(400);
  });
});
