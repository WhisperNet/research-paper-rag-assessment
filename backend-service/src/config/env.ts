import { z } from 'zod';

const envSchema = z.object({
  API_PORT: z.string().default('8000'),
  LOG_LEVEL: z.string().default('info'),
  MONGO_URI: z.string().default('mongodb://localhost:27017'),
  MONGO_DB: z.string().default('rag'),
  QDRANT_URL: z.string().default('http://localhost:6333'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  RATE_LIMIT_WINDOW_MS: z.string().default('10000'),
  RATE_LIMIT_MAX: z.string().default('120'),
  EMBEDDER_URL: z.string().default('http://localhost:9100'),
});

export type Env = ReturnType<typeof envSchema.parse>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
