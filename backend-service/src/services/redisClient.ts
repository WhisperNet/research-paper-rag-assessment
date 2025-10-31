import Redis from 'ioredis';
import { loadEnv } from '../config/env';

let client: any = null;

export function getRedis(): any {
  if (client) return client;
  const env = loadEnv();
  client = new Redis(env.REDIS_URL);
  return client;
}

export async function pingRedis(): Promise<boolean> {
  const c = getRedis();
  await c.ping();
  return true;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } finally {
    try {
      client.disconnect();
    } catch {}
    client = null;
  }
}
