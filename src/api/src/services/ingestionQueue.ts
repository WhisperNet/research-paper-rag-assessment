import { Queue, Worker, JobsOptions } from 'bullmq';
import { getDb } from './mongoClient';
import { getQdrant } from './qdrantClient';
import { callEmbed } from './embedderClient';
import { logger } from '../config/logger';
import { loadEnv } from '../config/env';

const env = loadEnv();
const connection = { url: env.REDIS_URL } as any;

export const ingestQueue = new Queue('ingest_paper', { connection });

export async function enqueueIngest(paperId: string): Promise<void> {
  await ingestQueue.add(
    'ingest',
    { paperId } as any,
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    } as JobsOptions
  );
}

export function startIngestWorker(): void {
  // idempotent
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const worker = new Worker(
    'ingest_paper',
    async (job) => {
      const { paperId } = job.data as any;
      const db = await getDb();
      const paper = await db
        .collection('papers')
        .findOne({ _id: new (await import('mongodb')).ObjectId(paperId) });
      if (!paper) throw new Error('paper not found');
      // load chunks saved during upload
      const chunks = await db
        .collection('chunks')
        .find({ paper_id: paperId })
        .sort({ order: 1 })
        .toArray();
      if (!chunks.length) throw new Error('no chunks to index');

      const texts: string[] = chunks.map((c: any) => c.text);
      const batchSize = 64;
      const vectors: number[][] = [];
      let dim = 0;
      for (let i = 0; i < texts.length; i += batchSize) {
        const slice = texts.slice(i, i + batchSize);
        const resp = await callEmbed(slice);
        dim = resp.dim;
        vectors.push(...resp.vectors);
      }

      const qdrant = getQdrant();
      const collection = 'papers_chunks';
      // Ensure collection
      try {
        await qdrant.getCollection(collection);
      } catch {
        await qdrant.createCollection(collection, {
          vectors: { size: dim, distance: 'Cosine' },
        });
      }

      const baseId = Date.now();
      const points = chunks.map((c: any, idx: number) => ({
        id: baseId + idx,
        vector: vectors[idx],
        payload: {
          paper_id: paperId,
          paper_title: paper?.metadata?.title || paper?.filename,
          section: c.section,
          page: c.page,
          chunk_index: c.order,
          model: 'BAAI/bge-small-en-v1.5',
          vector_dim: dim,
          created_at: new Date().toISOString(),
        },
      }));
      await qdrant.upsert(collection, { points });

      await db
        .collection('papers')
        .updateOne(
          { _id: paper._id },
          { $set: { status: 'indexed', indexed_at: new Date() } }
        );
      logger.info({ paperId, count: points.length }, 'Ingestion complete');
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Ingest job failed');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Ingest job completed');
  });
}
