import { QdrantClient } from '@qdrant/js-client-rest';
import { loadEnv } from '../config/env';

let client: any = null;

export function getQdrant(): any {
  if (client) return client;
  const env = loadEnv();
  client = new QdrantClient({
    url: env.QDRANT_URL,
    checkCompatibility: false as any,
  });
  return client;
}

export async function pingQdrant(): Promise<boolean> {
  const c = getQdrant();
  await c.getCollections();
  return true;
}

const COLLECTION = 'papers_chunks';

export async function deleteByPaperId(paperId: string): Promise<number> {
  if (process.env.NODE_ENV === 'test') return 0;
  const c = getQdrant();
  const filter = { must: [{ key: 'paper_id', match: { value: paperId } }] };
  await c.delete(COLLECTION, { filter });
  // Qdrant delete does not return count; best-effort: return -1 to mean unknown
  return -1;
}

export async function countVectorsByPaperId(paperId: string): Promise<number> {
  if (process.env.NODE_ENV === 'test') return 0;
  const c = getQdrant();
  try {
    // Prefer count endpoint if available
    if (typeof (c as any).count === 'function') {
      const filter = { must: [{ key: 'paper_id', match: { value: paperId } }] };
      const resp = await (c as any).count(COLLECTION, { filter, exact: true });
      return Number(resp?.count || 0);
    }
  } catch {}
  // Fallback: scroll in batches and count
  let offset: any = undefined;
  let total = 0;
  // small batches to keep it light
  const limit = 256;
  const filter = { must: [{ key: 'paper_id', match: { value: paperId } }] };
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const resp = await c.scroll(COLLECTION, {
      with_vector: false,
      with_payload: false,
      limit,
      filter,
      offset,
    });
    const points: any[] = resp?.points || [];
    total += points.length;
    offset = resp?.next_page_offset;
    if (!offset || points.length === 0) break;
  }
  return total;
}
