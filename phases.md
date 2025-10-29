### Architecture overview (high-level)

- Backend API: Express + TypeScript on Bun
- Vector store: Qdrant
- Database: MongoDB
- LLM: Ollama (Llama 3)
- Embeddings/PDF pipeline: Python FastAPI microservice (PyMuPDF + sentence-transformers) for best quality/perf; Node-only path available but second-best
- Infra: Docker Compose (Ollama, Qdrant, MongoDB, Redis, services)
- Observability: Pino logs (JSON), basic metrics, error middleware
- Background jobs: BullMQ + Redis (ingestion, reindex, cleanup)
- Caching: Redis (retrieval and prompt assembly)
- Testing: Vitest + Supertest (API), PyTest (microservice)
- API schema validation: Zod
- Auth (optional bonus): API key header

Why this stack

- Express + TypeScript on Bun: familiar, typed, excellent DX, very fast runtime (Bun) with first-class TS.
- Python microservice: best-in-class PDF extraction (PyMuPDF) and embedding models (sentence-transformers). Keeps Node API lean and fast.
- Qdrant: required and excellent for similarity search; strong payload filtering.
- MongoDB: flexible document schema for papers, chunks metadata, and queries; fast iteration.
- Ollama (Llama 3): local, cost-free, good on technical content; portable with Docker.

---

### Phase 0 — Repo bootstrap and submission rails

- Goal: Fork, branch, scaffold monorepo structure, CI hygiene, shared config.
- Key decisions:
  - Monorepo structure with clear service boundaries.
  - Docker Compose for all infra to ensure reviewers can run in one command.
- Tasks:
  - Create `apps/api` (Express TS on Bun), `services/embedder` (Python FastAPI), `infra/docker-compose.yml`, `.env.example`, `requirements.txt` (Python), `package.json`, `tsconfig.json`, ESLint/Prettier, Vitest.
  - Add `PULL_REQUEST_TEMPLATE.md`, ensure `README.md` and `APPROACH.md` placeholders.
  - Add Makefile or npm scripts for build/run/test.
- Deliverables:
  - Bootable repo; `docker-compose up -d` brings up Mongo, Qdrant, Redis, Ollama.
- Acceptance criteria:
  - Health endpoints respond for API and embedder.
  - Lint/test pass locally.
  - Clear run instructions in top-level `README.md`.

Why: Reviewers value fast setup, clarity, and working infra out of the box.

---

### Phase 1 — API skeleton (Express + TS on Bun)

- Goal: Production-grade API foundation.
- Key decisions:
  - `zod` for request/response validation; `pino` for logs; central error handling.
- Tasks:
  - Set up Express with typed routes, error middleware, request logging, CORS.
  - Define base routes:
    - `GET /healthz`
    - `GET /api/version`
  - Wire config with `dotenv` and typed config helper.
- Deliverables:
  - Running API with structured logs and robust error responses.
- Acceptance criteria:
  - Contract: JSON error shape `{ error: { code, message, details? } }` everywhere.
  - OpenAPI doc stub (e.g., Redocly or `zod-to-openapi`) generated.

Why: Strong foundation reduces risk and accelerates later phases.

---

### Phase 2 — PDF ingestion pipeline (extraction + section-aware chunking)

- Goal: Deterministic, section-aware text extraction with page numbers.
- Key decisions:
  - Python FastAPI service with PyMuPDF for robust extraction; section detection heuristics (headings regex + TOC + font size).
  - Chunking: 1) split by section; 2) 500 token chunks with 50 token overlap; preserve section/page metadata.
- Tasks:
  - `POST /extract` (Python): input PDF (multipart), output JSON:
    - paper metadata (title, authors, year)
    - sections: name, page range
    - chunks: id, text, section, page, order
  - From API: `POST /api/papers/upload`:
    - Accept PDF → forward to embedder for extraction only (no embeddings yet).
    - Save paper stub in Mongo (status: “extracted”).
    - Enqueue background job to compute embeddings + index (Phase 3).
- Deliverables:
  - Reliable extraction across test PDFs, with consistent section labels.
- Acceptance criteria:
  - Handles multipage PDFs; returns section names and page numbers.
  - Throughput: 5 PDFs in < 2 minutes on normal hardware (without embeddings).

Why: Section-aware chunks materially improve retrieval precision and citation quality.

---

### Phase 3 — Embeddings and Qdrant indexing

- Goal: High-signal embeddings + resilient indexing workflow.
- Key decisions:
  - Embedding model: `bge-small-en-v1.5` or `e5-base` (quality/speed), fallback `all-MiniLM-L6-v2`. Normalize vectors; cosine similarity.
  - Qdrant payload design to enable paper and section filters.
- Tasks:
  - `POST /embed` (Python): accept batch chunk texts → return vectors.
  - BullMQ job `ingest:paper`:
    - Fetch extracted chunks → call `embed` → upsert to Qdrant with payload:
      - `paper_id`, `paper_title`, `section`, `page`, `chunk_index`, `model`, `vector_dim`, `created_at`.
    - Update Mongo paper status to “indexed”.
  - Idempotent upsert; consistent collection name, e.g., `papers_chunks`.
- Deliverables:
  - Qdrant collection created with proper config.
- Acceptance criteria:
  - All sample papers indexed; payload filter by `paper_id` works.
  - Embedding throughput > 1k chunks/min on local.

Why: Best-available open-source embedding models live in Python; Qdrant payloads make targeted retrieval trivial.

---

### Phase 4 — Intelligent Query system (retrieval → re-ranking → generation)

- Goal: Accurate, cited answers with confidence.
- Key decisions:
  - Retrieval: top-10 from Qdrant with optional `paper_ids` filter.
  - Re-ranking: lightweight re-scoring = sim score × section weight (Methods 1.2, Results 1.1, Abstract 0.9); optional cross-encoder re-ranker in Python (bonus).
  - Prompting: structured XML-style context; enforce citations.
- Tasks:
  - `POST /api/query`:
    - Input: `{ question, top_k=5, paper_ids? }`
    - Steps: vector search → re-rank → assemble context (cap ~2000 tokens) → call Ollama.
    - Response: `answer`, `citations[]`, `sources_used[]`, `confidence`.
  - Add guardrails: if low context coverage, say uncertain.
  - Cache retrieval results by normalized question (short TTL).
- Deliverables:
  - End-to-end query route producing grounded answers with citations.
- Acceptance criteria:
  - Meets response format from `README.md`.
  - Relevant citations with paper, section, page.
  - Latency p50 < 2.5s on local for typical questions.

Why: Simple, fast re-ranking boosts precision without heavy compute; structured prompts improve instruction adherence.

---

### Phase 5 — Paper management endpoints

- Goal: Operate on paper metadata and lifecycle.
- Tasks:
  - `GET /api/papers` — list with indexing status, counts.
  - `GET /api/papers/{id}` — details (sections, pages, chunk counts).
  - `DELETE /api/papers/{id}` — remove Mongo doc + Qdrant points (by payload filter).
  - `GET /api/papers/{id}/stats` — vector count, last indexed, source filename.
- Deliverables:
  - Complete paper lifecycle management.
- Acceptance criteria:
  - Deleting a paper fully purges its vectors and metadata.
  - Stats accurate to within a single job latency.

Why: Clear operational surface for evaluation and demos.

---

### Phase 6 — Query history and analytics

- Goal: Persist usage and expose insights.
- Tasks:
  - On every query: store `question`, `paper_ids`, `retrieval_time_ms`, `gen_time_ms`, `total_time_ms`, `top_sources`, `confidence`, `timestamp`, optional `rating`.
  - `GET /api/queries/history`
  - `GET /api/analytics/popular` — top questions/topics by term frequency; top papers by reference count.
- Deliverables:
  - Basic analytics routes.
- Acceptance criteria:
  - Data appears accurate and updates in real-time.
  - Handles >1k history rows without slowdown.

Why: Required by assessment; also useful for debugging and demo.

---

### Phase 7 — Quality: tests, validation, and evaluation loop

- Goal: Confidence via automated checks and repeatable evaluation.
- Tasks:
  - Unit tests (Vitest) for services: validation schemas, Qdrant client wrapper, prompt builder, citation formatter.
  - Contract tests against embedder service (Supertest + mocked Python or dockerized test).
  - Smoke tests that run the 20 provided queries and summarize hit-rate/coverage.
  - Load test (k6/Artillery) light pass on `/api/query`.
- Deliverables:
  - `tests/` with clear commands to run.
- Acceptance criteria:
  - > 60% coverage on core logic (bonus criteria).
  - 18/20 queries return relevant answers (from template’s bar).

Why: Testing wins points and reduces regression risk.

---

### Phase 8 — Observability, robustness, and DX polish

- Goal: Production readiness touches.
- Tasks:
  - Structured logging (pino) with correlation IDs.
  - Standard error codes and retryable failures.
  - Rate limiting (express-rate-limit) to protect LLM.
  - Basic metrics endpoint; optional Prometheus exporter.
  - Timeouts/cancellations for downstream calls; exponential backoff for embedder/Qdrant.
  - Configurable limits: `max_ctx_tokens`, `top_k`, `rerank_strategy`.
- Deliverables:
  - Stable behavior under stress and graceful failure modes.
- Acceptance criteria:
  - No unhandled rejections; logs are concise and useful.
  - Timeouts prevent hung requests; retries bounded.

Why: Makes the system understandable and maintainable at scale.

---

### Phase 9 — Documentation and submission polish

- Goal: Nail the assessment’s documentation criteria.
- Tasks:
  - Complete `README.md`: setup, run, API docs, curl examples, troubleshooting.
  - `APPROACH.md`: chunking, embeddings, prompt design, schema, trade-offs, limitations.
  - `architecture.png`: diagram of services and data flow.
  - `.env.example` complete; `docker-compose.yml` simple single-command boot.
  - Fill `PULL_REQUEST_TEMPLATE.md` fully.
- Deliverables:
  - Reviewer-ready docs with diagrams and examples.
- Acceptance criteria:
  - A reviewer can reproduce ingestion + query in <10 minutes following docs.

Why: High documentation quality is a scoring dimension and accelerates review.

---

### Phase 10 — Optimization and bonus features (optional)

- Options:
  - Hybrid retrieval (BM25 via Elasticsearch or Qdrant sparse vectors) + fusion.
  - Cross-encoder re-ranking (e.g., `bge-reranker-base`) in Python service.
  - Caching: response cache keyed by normalized question + paper filters.
  - Simple web UI (upload/query) for demo.
  - Export results to Markdown/PDF with citations.
  - Auth via API key header; per-key quotas.
- Acceptance criteria:
  - Demonstrable accuracy improvement (e.g., +5–10% on curated eval set) or UX win.

Why: Bonus points and stronger real-world fidelity.

---

### Proposed repo structure

```
repo-root/
├── apps/
│   └── api/                     # Express + TS on Bun
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   │   ├── papers.ts
│       │   │   ├── query.ts
│       │   │   └── analytics.ts
│       │   ├── services/
│       │   │   ├── qdrantClient.ts
│       │   │   ├── mongoClient.ts
│       │   │   ├── ollamaClient.ts
│       │   │   ├── embedderClient.ts
│       │   │   └── ingestionQueue.ts
│       │   ├── domain/
│       │   │   ├── chunking.ts          # types + interfaces
│       │   │   ├── retrieval.ts
│       │   │   └── prompting.ts
│       │   ├── middlewares/
│       │   ├── schemas/                 # zod
│       │   ├── config/
│       │   └── utils/
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
├── services/
│   └── embedder/               # Python FastAPI
│       ├── app.py
│       ├── requirements.txt
│       └── models/             # model loading, pooling
├── infra/
│   └── docker-compose.yml
├── scripts/
├── .env.example
├── APPROACH.md
└── README.md
```

---

### API contracts (selected)

- `POST /api/papers/upload` (multipart)
  - Response: `{ paper_id }` (ingestion job enqueued)
- `POST /api/query`
  - Request: `{ question: string, top_k?: number, paper_ids?: string[] }`
  - Response: `{ answer, citations[], sources_used[], confidence }`
- `GET /api/papers`, `GET /api/papers/{id}`, `DELETE /api/papers/{id}`, `GET /api/papers/{id}/stats`
- `GET /api/queries/history`, `GET /api/analytics/popular`
