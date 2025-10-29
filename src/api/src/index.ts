import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import apiRouter from './routes';
import { requestId } from './middlewares/requestId';
import { rateLimit } from './middlewares/rateLimit';
import { errorHandler } from './middlewares/errorHandler';
import { loadEnv } from './config/env';
import { openapiSpec } from './openapi/spec';
import healthRouter from './routes/health';

config();

const env = loadEnv();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/health', healthRouter);
app.get('/openapi.json', (_req: any, res: any) => res.json(openapiSpec));
app.use(requestId());
app.use(
  rateLimit({
    windowMs: Number(env.RATE_LIMIT_WINDOW_MS),
    max: Number(env.RATE_LIMIT_MAX),
  })
);
app.use('/api/v1', apiRouter);

// Not found
app.use((req: any, res: any) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
    requestId: (req as any).id,
  });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(errorHandler());

export default app;
