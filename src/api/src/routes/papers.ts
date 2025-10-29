import { Router } from 'express';
import multer from 'multer';
import { notImplemented, ok } from '../utils/http';
import { loadEnv } from '../config/env';
import { getDb } from '../services/mongoClient';
import { logger } from '../config/logger';

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();

router.get('/', (req: any, res: any) => notImplemented(res));
router.get('/:id', (req: any, res: any) => notImplemented(res));
router.delete('/:id', (req: any, res: any) => notImplemented(res));
router.get('/:id/stats', (req: any, res: any) => notImplemented(res));

router.post('/upload', upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'file is required' },
      });
    }
    const env = loadEnv();
    const embedderUrl = process.env.EMBEDDER_URL || 'http://localhost:9100';

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
    const extract = await resp.json();

    const db = await getDb();
    const result = await db.collection('papers').insertOne({
      filename: req.file.originalname,
      metadata: extract.metadata,
      sections: extract.sections,
      chunk_count: Array.isArray(extract.chunks) ? extract.chunks.length : 0,
      status: 'extracted',
      created_at: new Date(),
    });

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
