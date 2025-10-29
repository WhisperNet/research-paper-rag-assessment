import { Router } from 'express';
import pino from 'pino';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import { QdrantClient } from '@qdrant/js-client-rest';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const router = Router();

// No module-level persistent clients for health checks to avoid leaks

async function checkMongo(): Promise<{ ok: boolean; message?: string }> {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  try {
    // Ensure we connect only once; guard using internal topology if available
    const anyClient: any = client as any;
    const alreadyConnected = !!(
      anyClient.topology &&
      typeof anyClient.topology.isConnected === 'function' &&
      anyClient.topology.isConnected()
    );
    if (!alreadyConnected) {
      await client.connect();
    }
    await client.db('admin').command({ ping: 1 });
    return { ok: true };
  } catch (e: any) {
    logger.warn({ err: e }, 'Mongo check failed');
    return { ok: false, message: e?.message };
  } finally {
    try {
      await client.close();
    } catch (closeErr: any) {
      logger.warn({ err: closeErr }, 'Mongo client close failed');
    }
  }
}

async function checkRedis(): Promise<{ ok: boolean; message?: string }> {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = new Redis(url);
  try {
    await client.ping();
    return { ok: true };
  } catch (e: any) {
    logger.warn({ err: e }, 'Redis check failed');
    return { ok: false, message: e?.message };
  } finally {
    try {
      // Prefer graceful shutdown
      await client.quit();
    } catch (quitErr: any) {
      logger.warn({ err: quitErr }, 'Redis client quit failed');
      try {
        client.disconnect();
      } catch (discErr: any) {
        logger.warn({ err: discErr }, 'Redis client disconnect failed');
      }
    }
  }
}

async function checkQdrant(): Promise<{ ok: boolean; message?: string }> {
  const url = process.env.QDRANT_URL || 'http://localhost:6333';
  const client = new QdrantClient({ url });
  try {
    await client.getCollections();
    return { ok: true };
  } catch (e: any) {
    logger.warn({ err: e }, 'Qdrant check failed');
    return { ok: false, message: e?.message };
  } finally {
    // Qdrant REST client typically doesn't hold persistent connections, but close if available
    try {
      const maybeClose: any = (client as any).close;
      if (typeof maybeClose === 'function') {
        await maybeClose.call(client);
      }
    } catch (closeErr: any) {
      logger.warn({ err: closeErr }, 'Qdrant client close failed');
    }
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
