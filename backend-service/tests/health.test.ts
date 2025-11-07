import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('health endpoints', () => {
  it('GET /health/healthz returns 200', async () => {
    const res = await (request(app) as any).get('/health/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /openapi.json returns 200', async () => {
    const res = await (request(app) as any).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
  });
});
