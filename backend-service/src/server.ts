import { config } from 'dotenv';
import app from './index';
import { loadEnv } from './config/env';
import { logger } from './config/logger';

config();
const env = loadEnv();

const port = Number(env.API_PORT);
const server = app.listen(port, () => {
  logger.info({ port }, 'API listening');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error({ port, err }, 'Port already in use');
  } else if (err.code === 'EACCES') {
    logger.error({ port, err }, 'Permission denied for port');
  } else {
    logger.error({ port, err }, 'Failed to start server');
  }
  process.exit(1);
});
