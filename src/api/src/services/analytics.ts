import { getDb } from './mongoClient';

export type TopSource = {
  paper_id: string;
  section?: string;
  page?: number;
  score?: number;
};

export type QueryHistoryDoc = {
  question: string;
  normalized_question: string;
  paper_ids?: string[];
  retrieval_time_ms: number;
  gen_time_ms: number;
  total_time_ms: number;
  top_sources: TopSource[];
  citations: any[];
  sources_used: string[];
  confidence: number;
  created_at: Date;
  rating?: number;
};

export function normalizeQuestion(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export async function saveQueryHistory(doc: QueryHistoryDoc): Promise<string> {
  const db = await getDb();
  const res = await db.collection('queries').insertOne(doc);
  return String(res.insertedId);
}

export async function ensureQueryIndexes(): Promise<void> {
  const db = await getDb();
  const col = db.collection('queries');
  await col.createIndex({ created_at: -1 }, { name: 'created_at_desc' });
  await col.createIndex({ normalized_question: 1 }, { name: 'norm_q_asc' });
}

export async function aggregatePopular(limit = 20): Promise<{
  top_questions: { question: string; count: number }[];
  top_papers: { paper_id: string; paper_title?: string; count: number }[];
}> {
  const db = await getDb();

  const questions = await db
    .collection('queries')
    .aggregate([
      {
        $group: {
          _id: '$normalized_question',
          count: { $sum: 1 },
          any_q: { $first: '$question' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, question: '$any_q', count: 1 } },
    ])
    .toArray();

  const papers = await db
    .collection('queries')
    .aggregate([
      { $unwind: { path: '$top_sources', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$top_sources.paper_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $addFields: { paper_obj_id: { $toObjectId: '$_id' } } },
      {
        $lookup: {
          from: 'papers',
          localField: 'paper_obj_id',
          foreignField: '_id',
          as: 'paper_docs',
        },
      },
      {
        $project: {
          _id: 0,
          paper_id: { $toString: '$_id' },
          paper_title: { $arrayElemAt: ['$paper_docs.metadata.title', 0] },
          count: 1,
        },
      },
    ])
    .toArray();

  return { top_questions: questions, top_papers: papers };
}
