import { config } from 'dotenv';
import app from './index';
import { loadEnv } from './config/env';
import { logger } from './config/logger';

config();
const env = loadEnv();

const port = Number(env.API_PORT);
app.listen(port, () => {
  logger.info({ port }, 'API listening');
});
