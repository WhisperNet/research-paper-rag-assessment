## Research Paper RAG API Documentation

This document describes the current API (up to Phase 6 per `phases.md`). The API is an Express + TypeScript service running on Bun.

- Base URL: `http://localhost:8000`
- API prefix: `/api/v1`
- OpenAPI spec: `GET /openapi.json`
- Health endpoints: under `/health`

All successful responses follow the shape:

```json
{ "success": true, "data": { ... }, "meta"?: { ... } }
```

All errors follow the shape:

```json
{ "success": false, "error": { "code": "STRING_CODE", "message": "human readable" }, "requestId"?: "..." }
```

### Health

#### GET /health/healthz
- Purpose: Liveness probe for the API process.
- Response 200:
```json
{ "status": "ok", "service": "api", "time": "ISO-8601" }
```

Example:
```bash
curl -s http://localhost:8000/health/healthz | jq
```

#### GET /health/readyz
- Purpose: Readiness probe checking dependencies (MongoDB, Redis, Qdrant, Ollama).
- Responses:
  - 200: All dependencies are reachable
  - 503: One or more dependencies are unavailable
- Body:
```json
{ "ready": true, "details": { "mongo": {"ok": true}, "redis": {"ok": true}, "qdrant": {"ok": true}, "ollama": {"ok": true} } }
```

Example:
```bash
curl -s http://localhost:8000/health/readyz | jq
```

### Query

#### POST /api/v1/query
- Purpose: Full RAG pipeline: retrieve, re-rank, assemble context, generate answer with citations.
- Request (JSON):
```json
{
  "question": "string (required)",
  "top_k": 5,
  "paper_ids": ["optional", "limit retrieval to these paper ids"]
}
```
- Notes:
  - `top_k` min 1, max 10. Defaults to 5.
  - Results are cached briefly in Redis by normalized question and filters.
  - In test mode (`NODE_ENV=test`) the answer text is stubbed.
- Success 200 `data`:
```json
{
  "answer": "string",
  "citations": [
    { "paper_title": "string", "section": "string", "page": 1, "relevance_score": 0.87 }
  ],
  "sources_used": ["filenames or identifiers"],
  "confidence": 0.2
}
```
- Guardrail: if no context retrieved, returns an uncertain answer with empty citations and low confidence.

Example:
```bash
curl -s \
  -X POST http://localhost:8000/api/v1/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"What methodology was used in the transformer paper?","top_k":5}' | jq
```

Filter by specific papers:
```bash
curl -s \
  -X POST http://localhost:8000/api/v1/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"Summarize results","paper_ids":["<paper_id_1>","<paper_id_2>"]}' | jq
```

### Papers

#### GET /api/v1/papers
- Purpose: List papers with basic metadata and indexing status.
- Success 200 `data`:
```json
{ "items": [
  { "id": "string", "filename": "string", "title": "string|null", "status": "extracted|indexed", "chunk_count": 0, "created_at": "ISO-8601", "indexed_at": "ISO-8601|null" }
]}
```

Example:
```bash
curl -s http://localhost:8000/api/v1/papers | jq
```

#### GET /api/v1/papers/{id}
- Purpose: Get full paper details including extracted sections and counts.
- Path params:
  - `id`: MongoDB ObjectId string
- Success 200 `data`:
```json
{
  "id": "string",
  "filename": "string",
  "metadata": { "title": "string", "authors": ["..."], "year": 2020, "...": "..." },
  "sections": [ { "name": "Abstract", "start_page": 1, "end_page": 1 } ],
  "chunk_count": 12,
  "status": "extracted|indexed",
  "created_at": "ISO-8601",
  "indexed_at": "ISO-8601|null"
}
```

Example:
```bash
curl -s http://localhost:8000/api/v1/papers/<paper_id> | jq
```

#### DELETE /api/v1/papers/{id}
- Purpose: Remove a paper, its chunks, and its vectors from Qdrant.
- Success 200 `data`:
```json
{ "removed_vectors": 123, "removed_chunks": 123, "removed_paper": true }
```

Example:
```bash
curl -s -X DELETE http://localhost:8000/api/v1/papers/<paper_id> | jq
```

#### GET /api/v1/papers/{id}/stats
- Purpose: Vector and chunk counts for a paper.
- Success 200 `data`:
```json
{ "paper_id": "string", "filename": "string", "vector_count": 123, "chunk_count": 123, "indexed_at": "ISO-8601|null" }
```

Example:
```bash
curl -s http://localhost:8000/api/v1/papers/<paper_id>/stats | jq
```

#### POST /api/v1/papers/upload
- Purpose: Upload a PDF, extract sections/chunks via the Python embedder service, persist metadata, and enqueue indexing.
- Multipart form fields:
  - `file`: the PDF file (max 25 MB)
- Success 200 `data`:
```json
{ "paper_id": "string" }
```
- Notes:
  - Extraction is done by the embedder at `EMBEDDER_URL` (default `http://localhost:9100`).
  - Chunks are stored and an ingestion job is enqueued to embed and upsert to Qdrant.

Example:
```bash
curl -s \
  -X POST http://localhost:8000/api/v1/papers/upload \
  -F file=@sample_papers/paper_1.pdf | jq
```

### Queries (History & Rating)

#### GET /api/v1/queries/history
- Purpose: Paginated query history.
- Query params:
  - `limit` (1..100, default 20)
  - `offset` (>=0, default 0)
- Success 200 `data`:
```json
{ "items": [
  {
    "question": "string",
    "paper_ids": ["..."],
    "retrieval_time_ms": 10,
    "gen_time_ms": 1200,
    "total_time_ms": 1210,
    "confidence": 0.82,
    "created_at": "ISO-8601"
  }
]}
```

Example:
```bash
curl -s 'http://localhost:8000/api/v1/queries/history?limit=10&offset=0' | jq
```

#### PATCH /api/v1/queries/{id}/rating
- Purpose: Set a 1–5 satisfaction rating for a past query.
- Path params:
  - `id`: MongoDB ObjectId string (query document id)
- Request (JSON):
```json
{ "rating": 5 }
```
- Success 200 `data`:
```json
{ "id": "string", "rating": 5 }
```

Example:
```bash
curl -s \
  -X PATCH http://localhost:8000/api/v1/queries/<query_id>/rating \
  -H 'Content-Type: application/json' \
  -d '{"rating":4}' | jq
```

### Analytics

#### GET /api/v1/analytics/popular
- Purpose: Aggregate popular questions/topics and references.
- Query params:
  - `limit` (1..100, default 20)
- Success 200 `data`:
```json
{ "popular_questions": [ { "question": "string", "count": 3 } ], "popular_papers": [ { "paper_id": "string", "references": 5 } ] }
```

Example:
```bash
curl -s 'http://localhost:8000/api/v1/analytics/popular?limit=10' | jq
```

### OpenAPI

#### GET /openapi.json
- Purpose: Machine-readable OpenAPI 3.0 spec for this API.

Example:
```bash
curl -s http://localhost:8000/openapi.json | jq '.paths | keys'
```

### Notes & Environment

- Default port: `API_PORT=8000` (see `src/api/src/config/env.ts`).
- Dependencies:
  - MongoDB (`MONGO_URI`, default `mongodb://localhost:27017`, DB `rag`)
  - Qdrant (`QDRANT_URL`, default `http://localhost:6333`)
  - Redis (`REDIS_URL`, default `redis://localhost:6379`)
  - Ollama (`OLLAMA_BASE_URL`, default `http://localhost:11434`)
- Rate limiting: window `RATE_LIMIT_WINDOW_MS` (default 60000 ms), max `RATE_LIMIT_MAX` (default 120 requests/window).


