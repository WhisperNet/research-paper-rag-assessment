import pino from 'pino';
import { loadEnv } from './env';

const env = loadEnv();

export const logger = pino({ level: env.LOG_LEVEL });


