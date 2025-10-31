import { getQdrant } from './qdrantClient';
import { callEmbed } from './embedderClient';

export type RetrievedChunk = {
  id: string | number;
  score: number;
  text?: string; // text is not stored in Qdrant; we will fetch from Mongo if needed later
  payload: {
    paper_id: string;
    paper_title?: string;
    section?: string;
    page?: number;
    chunk_index?: number;
    model?: string;
    vector_dim?: number;
    created_at?: string;
  };
};

export async function retrieveFromQdrant(
  question: string,
  topK: number,
  paperIds?: string[]
): Promise<RetrievedChunk[]> {
  const qdrant = getQdrant();

  // Embed question into a vector
  const { vectors } = await callEmbed([question]);
  const queryVector = vectors[0];

  const filter =
    paperIds && paperIds.length
      ? {
          must: [
            {
              key: 'paper_id',
              match: { any: paperIds },
            },
          ],
        }
      : undefined;

  const result = await qdrant.search('papers_chunks', {
    vector: queryVector,
    limit: Math.max(topK, 1) * 2, // overfetch for later re-ranking
    with_payload: true,
    filter,
  });

  return (result || []).map((r: any) => ({
    id: r.id,
    score: r.score,
    payload: r.payload,
  }));
}

export function rerankBySectionWeight(
  items: RetrievedChunk[],
  topK: number
): RetrievedChunk[] {
  const sectionWeights: Record<string, number> = {
    abstract: 0.9,
    introduction: 1.0,
    methods: 1.2,
    methodology: 1.2,
    results: 1.1,
    discussion: 1.05,
    conclusion: 1.0,
    unknown: 0.9,
  };

  const scored = items.map((it) => {
    const section = (it.payload.section || '').toLowerCase();
    const mappedSection = section || 'unknown';
    const weight = sectionWeights[mappedSection] || 1.0;
    const finalScore = it.score * weight;
    return { ...it, score: finalScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(topK, 1));
}
