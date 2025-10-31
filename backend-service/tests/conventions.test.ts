import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('API conventions', () => {
  it('returns error envelope on 404 with requestId', async () => {
    const res = await (request(app) as any).get('/not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('NOT_FOUND');
    expect(res.body.requestId).toBeDefined();
  });
});
