const API_BASE =
  (import.meta.env.VITE_API_BASE as string) || 'http://localhost:8000/api/v1';
const SERVICE_BASE =
  (import.meta.env.VITE_SERVICE_BASE as string) || 'http://localhost:8000';

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
  topK?: number,
  paperIds?: string[]
): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      top_k: topK ?? 5,
      paper_ids: paperIds && paperIds.length ? paperIds : undefined,
    }),
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
  rating?: number;
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

export async function findRecentHistoryIdByQuestion(
  question: string
): Promise<string | null> {
  const items = await getHistory(5, 0);
  const match = items.find(
    (i) => (i.question || '').trim() === question.trim()
  );
  return match?._id ?? null;
}

export async function rateQuery(id: string, rating: number): Promise<void> {
  const res = await fetch(`${API_BASE}/queries/${id}/rating`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw new Error(`Rating failed: ${res.status}`);
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

export type PaperStats = {
  paper_id: string;
  filename: string;
  vector_count: number;
  chunk_count: number;
  indexed_at: string | null;
};

export async function getPaperStats(paperId: string): Promise<PaperStats> {
  const res = await fetch(`${API_BASE}/papers/${paperId}/stats`);
  if (!res.ok) throw new Error(`Paper stats failed: ${res.status}`);
  const payload = await res.json();
  return payload?.data ?? payload;
}

export type ReadyDetails = {
  mongo: { ok: boolean; message?: string };
  redis: { ok: boolean; message?: string };
  qdrant: { ok: boolean; message?: string };
  ollama: { ok: boolean; message?: string };
};
export type ApiHealth = { ready: boolean; details: ReadyDetails };

export async function getApiHealth(): Promise<ApiHealth> {
  const res = await fetch(`${SERVICE_BASE}/health/readyz`);
  if (!res.ok) throw new Error(`API health failed: ${res.status}`);
  return (await res.json()) as ApiHealth;
}

export type ApiLiveness = { status: string; service?: string; time?: string };
export async function getApiLiveness(): Promise<ApiLiveness> {
  const res = await fetch(`${SERVICE_BASE}/health/healthz`);
  if (!res.ok) throw new Error(`API liveness failed: ${res.status}`);
  return (await res.json()) as ApiLiveness;
}

export type EmbedderHealth = { status: string; service: string };
export async function getEmbedderHealth(): Promise<EmbedderHealth> {
  const base =
    (import.meta.env.VITE_EMBEDDER_BASE as string) || 'http://localhost:9100';
  const res = await fetch(`${base.replace(/\/$/, '')}/healthz`);
  if (!res.ok) throw new Error(`Embedder health failed: ${res.status}`);
  return (await res.json()) as EmbedderHealth;
}
