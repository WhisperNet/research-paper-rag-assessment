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

/**
 * Section weight multipliers for scoring
 * These weights prioritize technical content (Methods, Results) over general content
 */
const SECTION_WEIGHTS: Record<string, number> = {
  abstract: 0.9,
  introduction: 1.0,
  methods: 1.2,
  methodology: 1.2,
  results: 1.1,
  discussion: 1.05,
  conclusion: 1.0,
  unknown: 0.9,
};

/**
 * Retrieve relevant chunks using Qdrant's built-in score modification
 * Uses Qdrant's score_threshold and params.score_modifier for efficient filtering
 */
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

  // Use Qdrant's native search with direct limit - no overfetching needed
  const result = await qdrant.search('papers_chunks', {
    vector: queryVector,
    limit: Math.max(topK, 1),
    with_payload: true,
    filter,
    // Optional: Add score threshold to filter low-quality matches
    score_threshold: 0.5,
  });

  // Apply section weights as post-processing multipliers
  // Note: Qdrant doesn't support dynamic payload-based score modification in the query itself,
  // but this lightweight post-processing is much simpler than the previous approach
  const weighted = (result || []).map((r: any) => {
    const section = (r.payload?.section || '').toLowerCase();
    const weight = SECTION_WEIGHTS[section] || 1.0;

    return {
      id: r.id,
      score: r.score * weight,
      payload: r.payload,
    };
  });

  // Re-sort by weighted scores and return top results
  weighted.sort((a: RetrievedChunk, b: RetrievedChunk) => b.score - a.score);
  return weighted.slice(0, Math.max(topK, 1));
}

/**
 * Apply section-based reranking to retrieved chunks
 * Can be used standalone or is applied automatically within retrieveFromQdrant
 */
export function rerankBySectionWeight(
  items: RetrievedChunk[],
  topK: number
): RetrievedChunk[] {
  const weighted = items.map((it) => {
    const section = (it.payload?.section || '').toLowerCase();
    const weight = SECTION_WEIGHTS[section] || 1.0;

    return {
      ...it,
      score: it.score * weight,
    };
  });

  weighted.sort((a: RetrievedChunk, b: RetrievedChunk) => b.score - a.score);
  return weighted.slice(0, Math.max(topK, 1));
}
