import { describe, it, expect } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../src/index';
import { getDb } from '../src/services/mongoClient';

describe('ingestion flow', () => {
  it('uploads and eventually marks paper indexed', async () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const samplePath = path.join(repoRoot, 'sample_papers', 'paper_1.pdf');
    expect(fs.existsSync(samplePath)).toBe(true);

    const res = await (request(app) as any)
      .post('/api/v1/papers/upload')
      .attach('file', samplePath);
    expect([200]).toContain(res.status);
    const paperId = res.body.data.paper_id;
    expect(paperId).toBeDefined();

    // Poll Mongo for status change to indexed (worker runs in-process)
    const db = await getDb();
    const deadline = Date.now() + 180_000; // up to 180s to allow first-time model downloads/indexing
    let status = 'extracted';
    while (Date.now() < deadline) {
      const doc = await db
        .collection('papers')
        .findOne({ _id: new (await import('mongodb')).ObjectId(paperId) });
      status = doc?.status;
      if (status === 'indexed') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(status).toBe('indexed');
  }, 120000);
});
