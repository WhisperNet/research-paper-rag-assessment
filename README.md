## Research Paper RAG – Phase 0 Bootstrap

Quick start for infra and API skeleton.

### Prerequisites

- Bun >= 1.1
- Docker & Docker Compose
- Python 3.10+ (optional for embedder stub)
- Ollama installed on host, model pulled: `ollama pull llama3`

### Start infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

### Run API (Bun + TypeScript)

```bash
cd src/api
bun install
bun run dev
# API_PORT defaults to 8000; set via env if needed
```

### (Optional) Run embedder stub

```bash
cd src/embedder
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 9100
```

### Health checks

```bash
curl http://localhost:8000/health/healthz
curl http://localhost:8000/health/readyz
```

`/readyz` verifies MongoDB, Redis, Qdrant, and Ollama connectivity.

### Environment

Default local endpoints are baked in. Override via env vars:

- `API_PORT`, `LOG_LEVEL`
- `MONGO_URI`, `MONGO_DB`
- `QDRANT_URL`, `REDIS_URL`, `OLLAMA_BASE_URL`

### Key API endpoints

Query

- POST `/api/v1/query` — { question, top_k?, paper_ids? } => { answer, citations[], sources_used[], confidence }

Papers

- GET `/api/v1/papers`
- GET `/api/v1/papers/{id}`
- GET `/api/v1/papers/{id}/stats`
- DELETE `/api/v1/papers/{id}`

Analytics & History (Phase 6)

- GET `/api/v1/queries/history?limit=&offset=` — recent queries, newest first
- PATCH `/api/v1/queries/{id}/rating` — body: { rating: 1..5 }
- GET `/api/v1/analytics/popular?limit=` — { top_questions[], top_papers[] }

OpenAPI

- GET `/openapi.json`
