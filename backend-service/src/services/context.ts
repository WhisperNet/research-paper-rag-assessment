import { getDb } from './mongoClient';
import type { RetrievedChunk } from './retrieval';

export type ContextBuilt = {
  contextItems: Array<{
    text: string;
    source: {
      paper_id: string;
      paper_title?: string;
      section?: string;
      page?: number;
      chunk_index?: number;
    };
  }>;
  citations: Array<{
    paper_title?: string;
    section?: string;
    page?: number;
    relevance_score: number;
  }>;
  sourcesUsed: string[];
};

export async function buildContext(
  retrieved: RetrievedChunk[],
  maxChars = 8000
): Promise<ContextBuilt> {
  const db = await getDb();
  const out: ContextBuilt = {
    contextItems: [],
    citations: [],
    sourcesUsed: [],
  };

  // Group by paper_id for efficient lookups
  const byPaper: Record<string, RetrievedChunk[]> = {};
  for (const item of retrieved) {
    const pid = item.payload.paper_id;
    byPaper[pid] = byPaper[pid] || [];
    byPaper[pid].push(item);
  }

  let total = 0;
  for (const [paperId, items] of Object.entries(byPaper)) {
    const orders = items
      .map((i) => i.payload.chunk_index)
      .filter((n) => n !== undefined);
    const chunks = await db
      .collection('chunks')
      .find({ paper_id: paperId, order: { $in: orders } })
      .toArray();
    const orderToText = new Map<number, string>();
    for (const c of chunks) orderToText.set(c.order, c.text);

    for (const r of items) {
      const text =
        orderToText.get((r.payload.chunk_index as number) || -1) || '';
      const entry = {
        text,
        source: {
          paper_id: r.payload.paper_id,
          paper_title: r.payload.paper_title,
          section: r.payload.section,
          page: r.payload.page,
          chunk_index: r.payload.chunk_index,
        },
      };
      const size = text.length;
      if (total + size > maxChars) continue;
      total += size;
      out.contextItems.push(entry);
      out.citations.push({
        paper_title: r.payload.paper_title,
        section: r.payload.section,
        page: r.payload.page,
        relevance_score: Number(r.score) || 0,
      });
      if (
        r.payload.paper_title &&
        !out.sourcesUsed.includes(r.payload.paper_title)
      ) {
        out.sourcesUsed.push(r.payload.paper_title);
      }
    }
  }

  // De-duplicate citations (by paper_title + section + page), keep highest score, cap to 5
  const seen = new Map<string, number>();
  const unique: ContextBuilt['citations'] = [];
  for (const c of out.citations) {
    const key = `${c.paper_title || ''}|${c.section || ''}|${c.page || ''}`;
    const existingIdx = seen.get(key);
    if (existingIdx === undefined) {
      seen.set(key, unique.length);
      unique.push(c);
    } else if (c.relevance_score > unique[existingIdx].relevance_score) {
      unique[existingIdx] = c;
    }
  }
  unique.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  out.citations = unique.slice(0, 5);

  return out;
}
