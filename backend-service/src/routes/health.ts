import { Router } from 'express';
import { getDb } from '../services/mongoClient';
import { getRedis } from '../services/redisClient';
import { getQdrant } from '../services/qdrantClient';
import { logger } from '../config/logger';

const router = Router();

async function checkMongo(): Promise<{ ok: boolean; message?: string }> {
  try {
    const db = await getDb();
    await db.admin().command({ ping: 1 });
    return { ok: true };
  } catch (e: any) {
    logger.warn({ err: e }, 'Mongo check failed');
    return { ok: false, message: e?.message };
  }
}

async function checkRedis(): Promise<{ ok: boolean; message?: string }> {
  try {
    const client = getRedis();
    await client.ping();
    return { ok: true };
  } catch (e: any) {
    logger.warn({ err: e }, 'Redis check failed');
    return { ok: false, message: e?.message };
  }
}

async function checkQdrant(): Promise<{ ok: boolean; message?: string }> {
  try {
    const client = getQdrant();
    await client.getCollections();
    return { ok: true };
  } catch (e: any) {
    logger.warn({ err: e }, 'Qdrant check failed');
    return { ok: false, message: e?.message };
  }
}

async function checkOllama(): Promise<{ ok: boolean; message?: string }> {
  try {
    const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const resp = await fetch(`${base}/api/tags`, { method: 'GET' });
    if (!resp.ok) return { ok: false, message: `status ${resp.status}` };
    return { ok: true };
  } catch (e: any) {
    logger.warn({ err: e }, 'Ollama check failed');
    return { ok: false, message: e?.message };
  }
}

router.get('/healthz', (_req: any, res: any) => {
  res.json({ status: 'ok', service: 'api', time: new Date().toISOString() });
});

router.get('/readyz', async (_req: any, res: any) => {
  const [mongo, redis, qdrant, ollama] = await Promise.all([
    checkMongo(),
    checkRedis(),
    checkQdrant(),
    checkOllama(),
  ]);

  const details = { mongo, redis, qdrant, ollama };
  const allOk = mongo.ok && redis.ok && qdrant.ok && ollama.ok;
  res.status(allOk ? 200 : 503).json({ ready: allOk, details });
});

export default router;
