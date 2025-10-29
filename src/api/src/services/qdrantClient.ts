import { QdrantClient } from '@qdrant/js-client-rest';
import { loadEnv } from '../config/env';

let client: any = null;

export function getQdrant(): any {
  if (client) return client;
  const env = loadEnv();
  client = new QdrantClient({ url: env.QDRANT_URL });
  return client;
}

export async function pingQdrant(): Promise<boolean> {
  const c = getQdrant();
  await c.getCollections();
  return true;
}
