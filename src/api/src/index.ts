import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { z } from 'zod';
import pino from 'pino';
import healthRouter from './routes/health';

config();

const envSchema = z.object({
  API_PORT: z.string().default('8000'),
  LOG_LEVEL: z.string().default('info'),
});

const env = envSchema.parse(process.env);
const logger = pino({ level: env.LOG_LEVEL });

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/health', healthRouter);

// Not found
app.use((req: any, res: any) => {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: any, res: any, _next: any) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
});

const port = Number(env.API_PORT);
app.listen(port, () => {
  logger.info({ port }, 'API listening');
});

export default app;
