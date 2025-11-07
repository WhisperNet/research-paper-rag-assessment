import { describe, it, expect } from 'vitest';
import {
  rerankBySectionWeight,
  RetrievedChunk,
} from '../src/services/retrieval';
import { assemblePrompt } from '../src/utils/prompt';

describe('reranker', () => {
  it('boosts methods/results over abstract', () => {
    const items: RetrievedChunk[] = [
      { id: 1, score: 0.8, payload: { paper_id: 'p1', section: 'Abstract' } },
      { id: 2, score: 0.79, payload: { paper_id: 'p1', section: 'Methods' } },
      { id: 3, score: 0.78, payload: { paper_id: 'p1', section: 'Results' } },
    ];
    const reranked = rerankBySectionWeight(items, 3);
    // methods(1.2*0.79=0.948) > results(1.1*0.78=0.858) > abstract(0.9*0.8=0.72)
    expect(reranked.map((r) => r.id)).toEqual([2, 3, 1]);
  });
});

describe('prompt builder', () => {
  it('assembles XML-like prompt with citations metadata', () => {
    const prompt = assemblePrompt('What is used?', [
      {
        text: 'Transformer uses self-attention.',
        source: {
          paper_id: 'p3',
          paper_title: 'Attention is All You Need',
          section: 'Methodology',
          page: 3,
          chunk_index: 12,
        },
      },
    ]);
    expect(prompt).toContain('<context>');
    expect(prompt).toContain('Attention is All You Need');
    expect(prompt).toContain('<question>What is used?</question>');
  });
});
