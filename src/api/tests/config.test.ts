import { describe, it, expect } from 'vitest';
import { loadEnv } from '../src/config/env';

describe('env config', () => {
  it('applies defaults when missing', () => {
    const env = loadEnv();
    expect(env.API_PORT).toBeDefined();
    expect(env.MONGO_URI).toContain('mongodb://');
  });
});
