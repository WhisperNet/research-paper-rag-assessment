import { Router } from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import { ok } from '../utils/http';
import { loadEnv } from '../config/env';
import { getDb } from '../services/mongoClient';
import { logger } from '../config/logger';
import { enqueueIngest } from '../services/ingestionQueue';
import {
  deleteByPaperId,
  countVectorsByPaperId,
} from '../services/qdrantClient';
import { objectIdSchema } from '../schemas/validation';

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();

router.get('/', async (_req: any, res: any) => {
  try {
    const db = await getDb();
    const papers = await db
      .collection('papers')
      .find({}, { projection: {} })
      .sort({ created_at: -1 })
      .toArray();
    const items = papers.map((p: any) => ({
      id: String(p._id),
      filename: p.filename,
      title: p?.metadata?.title,
      status: p.status,
      chunk_count: p.chunk_count,
      created_at: p.created_at,
      indexed_at: p.indexed_at,
    }));
    ok(res, { items });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'list failed' },
    });
  }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const objectId = new ObjectId(id);
    const db = await getDb();
    const paper = await db.collection('papers').findOne({ _id: objectId });
    if (!paper)
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'paper not found' },
      });
    const chunkCount = await db
      .collection('chunks')
      .countDocuments({ paper_id: id });
    ok(res, {
      id: String(paper._id),
      filename: paper.filename,
      metadata: paper.metadata,
      sections: paper.sections,
      chunk_count: chunkCount,
      status: paper.status,
      created_at: paper.created_at,
      indexed_at: paper.indexed_at,
    });
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: e.errors[0].message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'details failed' },
    });
  }
});

router.delete('/:id', async (req: any, res: any) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const objectId = new ObjectId(id);
    const db = await getDb();
    const paper = await db.collection('papers').findOne({ _id: objectId });
    if (!paper)
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'paper not found' },
      });

    const removedVectors = await deleteByPaperId(id);
    const delChunks = await db
      .collection('chunks')
      .deleteMany({ paper_id: id });
    await db.collection('papers').deleteOne({ _id: objectId });

    ok(res, {
      removed_vectors: removedVectors,
      removed_chunks: delChunks.deletedCount || 0,
      removed_paper: true,
    });
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: e.errors[0].message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'delete failed' },
    });
  }
});

router.get('/:id/stats', async (req: any, res: any) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const objectId = new ObjectId(id);
    const db = await getDb();
    const paper = await db.collection('papers').findOne({ _id: objectId });
    if (!paper)
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'paper not found' },
      });

    const vectorCount = await countVectorsByPaperId(id);
    const chunkCount = await db
      .collection('chunks')
      .countDocuments({ paper_id: id });
    ok(res, {
      paper_id: id,
      filename: paper.filename,
      vector_count: vectorCount,
      chunk_count: chunkCount,
      indexed_at: paper.indexed_at || null,
    });
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: e.errors[0].message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: e?.message || 'stats failed' },
    });
  }
});

router.post('/upload', upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'file is required' },
      });
    }
    const env = loadEnv();
    const embedderUrl = env.EMBEDDER_URL;

    let extract: any;
    if (process.env.NODE_ENV === 'test') {
      // synthetic extract in tests to avoid external dependency
      extract = {
        metadata: { title: req.file.originalname },
        sections: [{ name: 'Abstract', start_page: 1, end_page: 1 }],
        chunks: [
          {
            text: 'Test chunk content',
            section: 'Abstract',
            page: 1,
            order: 0,
          },
          { text: 'More content', section: 'Introduction', page: 2, order: 1 },
        ],
      };
    } else {
      const form = new FormData();
      form.append(
        'file',
        new Blob([req.file.buffer], { type: req.file.mimetype }),
        req.file.originalname
      );

      const resp = await fetch(`${embedderUrl}/extract`, {
        method: 'POST',
        body: form as any,
      });
      if (!resp.ok) {
        const text = await resp.text();
        logger.warn({ status: resp.status, text }, 'Embedder extract failed');
        return res.status(502).json({
          success: false,
          error: { code: 'EMBEDDER_FAILED', message: 'Extraction failed' },
        });
      }
      extract = await resp.json();
    }

    const db = await getDb();
    const result = await db.collection('papers').insertOne({
      filename: req.file.originalname,
      metadata: extract.metadata,
      sections: extract.sections,
      chunk_count: Array.isArray(extract.chunks) ? extract.chunks.length : 0,
      status: 'extracted',
      created_at: new Date(),
    });

    // persist chunks for ingestion
    if (Array.isArray(extract.chunks) && extract.chunks.length) {
      const docs = extract.chunks.map((c: any) => ({
        paper_id: String(result.insertedId),
        text: c.text,
        section: c.section,
        page: c.page,
        order: c.order,
      }));
      await db.collection('chunks').insertMany(docs);
    }

    // enqueue ingestion to index into Qdrant
    await enqueueIngest(String(result.insertedId));

    ok(res, { paper_id: String(result.insertedId) });
  } catch (e: any) {
    logger.error({ err: e }, 'Upload failed');
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Upload failed' },
    });
  }
});

export default router;
