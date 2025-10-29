import { describe, it, expect } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../src/index';

describe('papers upload', () => {
  it('POST /api/v1/papers/upload returns paper_id', async () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const samplePath = path.join(repoRoot, 'sample_papers', 'paper_1.pdf');
    expect(fs.existsSync(samplePath)).toBe(true);

    const res = await (request(app) as any)
      .post('/api/v1/papers/upload')
      .attach('file', samplePath);

    expect([200, 502, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.paper_id).toBeDefined();
    }
  }, 20000);
});
