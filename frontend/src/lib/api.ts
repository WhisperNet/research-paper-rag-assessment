const API_BASE =
  (import.meta.env.VITE_API_BASE as string) || 'http://localhost:8000/api/v1';

export type PaperItem = {
  id: string;
  filename?: string;
  title?: string | null;
  status?: string;
  chunk_count?: number;
  created_at?: string;
  indexed_at?: string | null;
};

export type PapersListResponse = { items: PaperItem[] };

export async function listPapers(): Promise<PaperItem[]> {
  const res = await fetch(`${API_BASE}/papers`);
  if (!res.ok) throw new Error(`List papers failed: ${res.status}`);
  const payload = await res.json();
  // Support both { items } and { success, data: { items } }
  const items: PaperItem[] = payload?.items ?? payload?.data?.items ?? [];
  return items;
}

export async function deletePaper(paperId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/papers/${paperId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function uploadPaper(file: File): Promise<{ paper_id: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/papers/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return (await res.json()) as { paper_id: string };
}

export type Citation = {
  paper_title?: string;
  section?: string;
  page?: number;
  relevance_score?: number;
};

export type QueryResponse = {
  answer: string;
  citations: Citation[];
  sources_used: Array<string>;
  confidence: number;
};

export async function askQuestion(
  question: string,
  topK?: number
): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, top_k: topK ?? 5 }),
  });
  if (!res.ok) throw new Error(`Query failed: ${res.status}`);
  const payload = await res.json();
  // Support both plain and wrapped { success, data }
  const data: QueryResponse = payload?.data ?? payload;
  return data;
}

export type HistoryItem = {
  _id: string;
  question: string;
  paper_ids?: string[] | null;
  answer?: string;
  retrieval_time_ms?: number;
  gen_time_ms?: number;
  total_time_ms?: number;
  confidence?: number;
  created_at?: string;
};

export async function getHistory(
  limit: number = 20,
  offset: number = 0
): Promise<HistoryItem[]> {
  const res = await fetch(
    `${API_BASE}/queries/history?limit=${limit}&offset=${offset}`
  );
  if (!res.ok) throw new Error(`History failed: ${res.status}`);
  const payload = await res.json();
  return payload?.items ?? payload?.data?.items ?? [];
}

export type PopularAnalytics = {
  top_questions: { question: string; count: number }[];
  top_papers: { paper_id: string; paper_title?: string; count: number }[];
};

export async function getPopular(
  limit: number = 20
): Promise<PopularAnalytics> {
  const res = await fetch(`${API_BASE}/analytics/popular?limit=${limit}`);
  if (!res.ok) throw new Error(`Popular analytics failed: ${res.status}`);
  const payload = await res.json();
  return payload?.data ?? payload; // backend returns ok(res, data)
}
