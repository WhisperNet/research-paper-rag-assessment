import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Stub routes return 501', () => {
  it('POST /api/v1/query returns 501', async () => {
    const res = await (request(app) as any)
      .post('/api/v1/query')
      .send({ question: 'x' });
    expect(res.status).toBe(501);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/v1/papers returns 501', async () => {
    const res = await (request(app) as any).get('/api/v1/papers');
    expect(res.status).toBe(501);
  });

  it('GET /api/v1/analytics/popular returns 501', async () => {
    const res = await (request(app) as any).get('/api/v1/analytics/popular');
    expect(res.status).toBe(501);
  });
});
