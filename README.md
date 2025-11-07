# Research Paper RAG Assessment System

**For a full documentation, please visit this site: http://ridowansikder.me/SageAI**

A production-grade Retrieval-Augmented Generation (RAG) system designed to help researchers efficiently query and understand academic papers. This system provides intelligent document ingestion, semantic search, and AI-powered question answering with accurate citations.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

This RAG system solves a critical problem for researchers: finding specific information across multiple academic papers without reading through hundreds of pages. The system can:

- **Ingest PDF research papers** with section-aware extraction
- **Answer complex queries** across multiple papers with citations
- **Provide analytics** on query patterns and popular topics
- **Track query history** for continuous improvement

### Key Capabilities

- Process multi-page PDF documents with metadata extraction
- Semantic search using state-of-the-art embedding models
- Section-aware chunking for improved retrieval precision
- Citation generation with paper title, section, and page numbers
- Query caching for improved response times
- Analytics dashboard for insights into usage patterns

## Architecture

The system follows a microservices architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                │
│                   (React + TypeScript Frontend)                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API Gateway / Backend                           │
│                   (Express + TypeScript on Bun)                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API Routes                                                   │  │
│  │  • Query Processing      • Paper Management                  │  │
│  │  • Analytics             • Health Checks                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Core Services                                                │  │
│  │  • Retrieval Engine      • Context Builder                   │  │
│  │  • Prompt Assembly       • Ingestion Queue (BullMQ)          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────┬──────────────┬──────────────┬──────────────┬──────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌───────────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐
│   Embedder    │ │ MongoDB  │ │  Qdrant  │ │   Redis Cache     │
│   Service     │ │ (Metadata│ │ (Vectors)│ │   + BullMQ        │
│ (FastAPI +    │ │  & Docs) │ │          │ │                   │
│  PyMuPDF +    │ │          │ │          │ │                   │
│  fastembed)   │ │          │ │          │ │                   │
└───────────────┘ └──────────┘ └──────────┘ └───────────────────┘
        │
        ▼
┌───────────────┐
│  Ollama LLM   │
│  (Llama 3)    │
│  (Host)       │
└───────────────┘
```

### Data Flow

**Document Ingestion Flow:**

```
PDF Upload → Backend → Embedder Service (Extract + Chunk)
           → MongoDB (Save metadata + chunks)
           → BullMQ Job → Embedder (Generate embeddings)
           → Qdrant (Store vectors + metadata)
```

**Query Flow:**

```
User Query → Backend → Embedder (Query embedding)
          → Qdrant (Vector search with filters)
          → Re-ranking (Section-based weights)
          → MongoDB (Fetch chunk texts)
          → Context Assembly → Prompt Engineering
          → Ollama LLM → Answer + Citations → User
```

## Features

### Core Features

#### 1. Document Ingestion System

- **PDF Processing**: Extract text from multi-page PDFs using PyMuPDF
- **Section Detection**: Automatically identify Abstract, Introduction, Methods, Results, Discussion, Conclusion, References
- **Intelligent Chunking**: 500-token chunks with 50-token overlap preserving semantic context
- **Metadata Extraction**: Title, authors, year, page numbers
- **Background Processing**: Asynchronous embedding generation via BullMQ job queue
- **Status Tracking**: Monitor ingestion status (extracted → indexed)

#### 2. Intelligent Query System

- **Semantic Search**: Vector similarity search using Qdrant
- **Re-ranking**: Section-based scoring (Methods: 1.2x, Results: 1.1x, Abstract: 0.9x)
- **Context Assembly**: Up to 8000 characters from top-ranked chunks
- **Citation Generation**: Automatic citation with paper title, section, and page
- **Confidence Scoring**: Based on retrieval relevance scores
- **Caching**: Redis-based query result caching (60s TTL)
- **Paper Filtering**: Optional filtering by specific paper IDs

#### 3. Paper Management

- List all papers with indexing status and chunk counts
- View detailed paper information including sections and metadata
- Delete papers and their associated vectors
- View paper statistics (vector count, indexing status)

#### 4. Query History & Analytics

- Complete query history with pagination
- Query performance metrics (retrieval time, generation time)
- Popular questions and topics analysis
- Most referenced papers tracking
- User satisfaction ratings (1-5 scale)

#### 5. Web Interface

- Modern, responsive React-based UI
- Interactive chat interface for querying papers
- File upload dialog with drag-and-drop support
- Analytics dashboard with visual insights
- Query history viewer
- System health monitoring
- Paper statistics and management

### Technical Features

- **Rate Limiting**: Protection against API abuse (120 requests/minute)
- **Error Handling**: Comprehensive error handling with structured responses
- **Logging**: Structured JSON logging via Pino
- **Request Tracing**: Request ID middleware for debugging
- **Health Checks**: Liveness (`/healthz`) and readiness (`/readyz`) endpoints
- **OpenAPI Documentation**: Machine-readable API specification
- **CORS Support**: Configurable cross-origin resource sharing
- **Security**: Helmet.js security headers

## Tech Stack

### Backend Service (Node.js/Bun)

- **Runtime**: Bun 1.1+ (ultra-fast JavaScript/TypeScript runtime)
- **Framework**: Express 4.x
- **Language**: TypeScript
- **Validation**: Zod schemas
- **Logging**: Pino (structured JSON logs)
- **Queue**: BullMQ with Redis
- **HTTP Client**: Native fetch API

### Embedder Service (Python)

- **Framework**: FastAPI
- **PDF Processing**: PyMuPDF (fitz) 1.24.9
- **Embeddings**: fastembed 0.3.6 (BAAI/bge-small-en-v1.5)
- **Server**: Uvicorn 0.30.6
- **Testing**: pytest 8.3.3

### Frontend Service (React)

- **Framework**: React 19.1.1
- **Language**: TypeScript
- **Routing**: React Router 6
- **Styling**: Tailwind CSS 4.1.16
- **UI Components**: Radix UI primitives
- **Markdown**: react-markdown with remark-gfm
- **Build Tool**: Vite 7.1.7

### Infrastructure

- **Vector Database**: Qdrant v1.7.0
- **Document Database**: MongoDB 7
- **Cache & Queue**: Redis 7
- **LLM**: Ollama (Llama 3) - running on host
- **Container Orchestration**: Docker Compose

### Development Tools

- **Testing**: Vitest 2.0.5 (backend), pytest (embedder)
- **Code Quality**: ESLint, TypeScript strict mode
- **Version Control**: Git
- **Container Images**: Official Docker images

## Prerequisites

Before you begin, ensure you have the following installed:

- **Bun** >= 1.1.0 ([Installation guide](https://bun.sh))
- **Docker** and **Docker Compose** ([Installation guide](https://docs.docker.com/get-docker/))
- **Python** 3.10+ (for local development of embedder)
- **Ollama** installed on host with Llama 3 model

### Installing Ollama

```bash
# Install Ollama (Linux/macOS)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the Llama 3 model
ollama run llama3:latest

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

## Quick Start

### Option 1: Full Stack with Docker Compose (Recommended)

This is the fastest way to get the entire system running:

```bash
# 1. Clone the repository
git clone git clone --branch submission/ridowan  https://github.com/WhisperNet/research-paper-rag-assessment.git
cd research-paper-rag-assessment

# 2. Ensure Ollama is running on your host
curl http://localhost:11434/api/tags

# 3. Start all services (infra + backend + embedder + frontend)
docker compose -f infra/docker-compose.linux.prod.yml up

# 4. Wait for services to initialize (~30 seconds)
# Check health status
curl http://localhost:8000/health/readyz

# 5. Access the application
# Frontend: http://localhost:8080
# Backend API: http://localhost:8000
# Embedder API: http://localhost:9100
```

The system will start:

- MongoDB on port 27017
- Qdrant on port 6333
- Redis on port 6379
- Embedder service on port 9100
- Backend API on port 8000
- Frontend UI on port 8080 (served via Nginx)

### Option 2: Development Setup (Individual Services)

For development with hot-reloading:

#### Step 1: Start Infrastructure Services

```bash
# Start MongoDB, Qdrant, Redis
docker compose -f infra/docker-compose.dependencies.yml up
```

#### Step 2: Start other services manually

- Local Python (for development)\*\*

```bash
cd embedder-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 9100
```

#### Step 3: Start Backend Service

```bash
cd backend-service
bun install
bun run dev
# API will be available at http://localhost:8000
```

#### Step 4: Start Frontend Service

```bash
cd frontend-service
bun install
bun run dev
# Frontend will be available at http://localhost:5173
```

### Verify Installation

```bash
# Check backend health
curl http://localhost:8000/health/healthz

# Check readiness (all dependencies)
curl http://localhost:8000/health/readyz | jq

# Check embedder health
curl http://localhost:9100/healthz

# Expected output:
# {"status":"ok","service":"embedder"}
```

### First Steps

#### 1. Upload Sample Papers

```bash
# Upload a research paper
curl -X POST http://localhost:8000/api/v1/papers/upload \
  -F "file=@sample_papers/paper_1.pdf"

# Response: {"success":true,"data":{"paper_id":"..."}}
```

#### 2. List Papers

```bash
curl http://localhost:8000/api/v1/papers | jq
```

#### 3. Query the System

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What methodology was used in this paper?",
    "top_k": 5
  }' | jq
```

#### 4. Access Web Interface

Open your browser and navigate to:

- **Production**: http://localhost:8080 (if using docker-compose)
- **Development**: http://localhost:5173 (if using vite dev server)

## Project Structure

```
research-paper-rag-assessment/
│
├── backend-service/              # Backend API (Express + TypeScript on Bun)
│   ├── src/
│   │   ├── config/              # Environment and logger configuration
│   │   │   ├── env.ts           # Environment variable loader with validation
│   │   │   └── logger.ts        # Pino logger setup
│   │   ├── middlewares/         # Express middlewares
│   │   │   ├── errorHandler.ts  # Global error handling
│   │   │   ├── rateLimit.ts     # Rate limiting middleware
│   │   │   └── requestId.ts     # Request ID tracking
│   │   ├── routes/              # API route handlers
│   │   │   ├── index.ts         # Route aggregator
│   │   │   ├── health.ts        # Health check endpoints
│   │   │   ├── papers.ts        # Paper management endpoints
│   │   │   ├── query.ts         # Main RAG query endpoint
│   │   │   ├── queries.ts       # Query history endpoints
│   │   │   └── analytics.ts     # Analytics endpoints
│   │   ├── services/            # Core business logic
│   │   │   ├── mongoClient.ts   # MongoDB connection
│   │   │   ├── qdrantClient.ts  # Qdrant vector DB client
│   │   │   ├── redisClient.ts   # Redis cache client
│   │   │   ├── embedderClient.ts # Embedder service HTTP client
│   │   │   ├── ollamaClient.ts  # Ollama LLM integration
│   │   │   ├── retrieval.ts     # Vector retrieval + re-ranking
│   │   │   ├── context.ts       # Context assembly from chunks
│   │   │   ├── analytics.ts     # Analytics data aggregation
│   │   │   ├── ingestionQueue.ts # BullMQ job queue
│   │   │   └── popularTopics.ts # Topic extraction
│   │   ├── schemas/             # Zod validation schemas
│   │   │   └── validation.ts    # Request/response schemas
│   │   ├── utils/               # Utility functions
│   │   │   ├── http.ts          # HTTP response helpers
│   │   │   └── prompt.ts        # Prompt engineering utilities
│   │   ├── openapi/             # OpenAPI specification
│   │   │   └── spec.ts          # API documentation
│   │   ├── index.ts             # App initialization
│   │   └── server.ts            # Server entry point
│   ├── tests/                   # Test suite
│   │   ├── config.test.ts       # Configuration tests
│   │   ├── health.test.ts       # Health endpoint tests
│   │   ├── query.test.ts        # Query pipeline tests
│   │   ├── papers.test.ts       # Paper management tests
│   │   ├── ingest.test.ts       # Ingestion tests
│   │   └── ...                  # More test files
│   ├── package.json             # Dependencies and scripts
│   ├── tsconfig.json            # TypeScript configuration
│   └── dist/                    # Compiled JavaScript (gitignored)
│
├── embedder-service/            # Python microservice for PDF + embeddings
│   ├── app.py                   # FastAPI application factory
│   ├── routes.py                # API routes (/extract, /embed, /healthz)
│   ├── models.py                # Pydantic models for validation
│   ├── core/                    # Core processing logic
│   │   ├── pdf.py               # PDF extraction (PyMuPDF)
│   │   └── text.py              # Text chunking and section detection
│   ├── requirements.txt         # Python dependencies
│   ├── test_extract.py          # Extraction tests
│   ├── test_embed.py            # Embedding tests
│   └── venv/                    # Python virtual environment (gitignored)
│
├── frontend-service/            # React web interface
│   ├── src/
│   │   ├── components/ui/       # React components
│   │   │   ├── Header.tsx       # Top navigation header
│   │   │   ├── Sidebar.tsx      # Side navigation menu
│   │   │   ├── ChatPanel.tsx    # Main query interface
│   │   │   ├── FileUploadDialog.tsx  # PDF upload modal
│   │   │   ├── DeleteFileDialog.tsx  # Delete confirmation
│   │   │   ├── HistoryPage.tsx  # Query history viewer
│   │   │   ├── AnalyticsPage.tsx # Analytics dashboard
│   │   │   ├── StatsPage.tsx    # Paper statistics
│   │   │   ├── HealthPage.tsx   # System health monitor
│   │   │   ├── MostDiscussedPage.tsx # Popular topics
│   │   │   ├── button.tsx       # UI button component
│   │   │   └── input.tsx        # UI input component
│   │   ├── lib/
│   │   │   ├── api.ts           # API client functions
│   │   │   └── utils.ts         # Utility functions
│   │   ├── App.tsx              # Main app component
│   │   ├── main.tsx             # React entry point
│   │   └── index.css            # Global styles
│   ├── public/                  # Static assets
│   ├── package.json             # Dependencies
│   ├── vite.config.ts           # Vite build configuration
│   └── tsconfig.json            # TypeScript configuration
│
├── infra/                       # Infrastructure configuration
│   ├── docker-compose.yml       # Main compose file (all services)
│   ├── docker-compose.*.yml     # Platform-specific variants
│   ├── backend.Dockerfile       # Backend container image
│   ├── embedder.Dockerfile      # Embedder container image
│   ├── frontend.Dockerfile      # Frontend container image (Nginx)
│   ├── nginx.conf               # Nginx configuration for frontend
│   └── example.env              # Environment variable template
│
├── sample_papers/               # Test dataset (5 research papers)
│   ├── paper_1.pdf
│   ├── paper_2.pdf
│   ├── paper_3.pdf
│   ├── paper_4.pdf
│   └── paper_5.pdf
│
├── README.md                    # This file
├── api_doc.md                   # Detailed API documentation
├── phases.md                    # Development phases and architecture decisions
├── given-instructions.md        # Original assessment requirements
├── SUBMISSION_GUIDE.md          # How to submit your solution
└── PULL_REQUEST_TEMPLATE.md     # PR template for submission
```

### Key Design Patterns

- **Microservices Architecture**: Clear separation between API, embedder, and frontend
- **Dependency Injection**: Services are initialized once and reused
- **Repository Pattern**: Data access abstraction via client services
- **Middleware Chain**: Express middlewares for cross-cutting concerns
- **Job Queue Pattern**: Async processing via BullMQ for long-running tasks
- **Cache-Aside Pattern**: Redis caching with fallback to primary data source

## API Documentation

### Base URL

```
http://localhost:8000
```

All API endpoints are prefixed with `/api` unless otherwise noted.

### Response Format

**Success Response:**

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }  // optional
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "requestId": "abc-123-def" // for debugging
}
```

### Health Endpoints

#### GET /health/healthz

Liveness probe - checks if the API process is running.

**Response:**

```json
{
  "status": "ok",
  "service": "api",
  "time": "2025-10-31T12:00:00.000Z"
}
```

#### GET /health/readyz

Readiness probe - checks all dependencies (MongoDB, Redis, Qdrant, Ollama).

**Response:**

```json
{
  "ready": true,
  "details": {
    "mongo": { "ok": true },
    "redis": { "ok": true },
    "qdrant": { "ok": true },
    "ollama": { "ok": true }
  }
}
```

### Query Endpoints

#### POST /api/v1/query

Execute a RAG query across indexed papers.

**Request Body:**

```json
{
  "question": "What methodology was used in the transformer paper?",
  "top_k": 5, // optional, default: 5, range: 1-10
  "paper_ids": ["..."] // optional, filter by specific papers
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "answer": "The transformer paper uses a self-attention mechanism...",
    "citations": [
      {
        "paper_title": "Attention is All You Need",
        "section": "Methods",
        "page": 3,
        "relevance_score": 0.89
      }
    ],
    "sources_used": ["paper3_nlp_transformers.pdf"],
    "confidence": 0.85
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the key findings?",
    "top_k": 5
  }' | jq
```

### Paper Management Endpoints

#### POST /api/v1/papers/upload

Upload a PDF research paper for ingestion.

**Request:**

- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `file` field with PDF file (max 25 MB)

**Response:**

```json
{
  "success": true,
  "data": {
    "paper_id": "67234abc123def456789"
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/api/v1/papers/upload \
  -F "file=@sample_papers/paper_1.pdf" | jq
```

#### GET /api/v1/papers

List all papers with their indexing status.

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "67234abc123def456789",
        "filename": "paper_1.pdf",
        "title": "Research Paper Title",
        "status": "indexed",
        "chunk_count": 123,
        "created_at": "2025-10-31T12:00:00.000Z",
        "indexed_at": "2025-10-31T12:01:30.000Z"
      }
    ]
  }
}
```

#### GET /api/v1/papers/{id}

Get detailed information about a specific paper.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "67234abc123def456789",
    "filename": "paper_1.pdf",
    "metadata": {
      "title": "Research Paper Title",
      "authors": "John Doe, Jane Smith",
      "year": "2024",
      "pages": 12
    },
    "sections": [
      {
        "name": "Abstract",
        "start_page": 1,
        "end_page": 1
      },
      {
        "name": "Introduction",
        "start_page": 1,
        "end_page": 2
      }
    ],
    "chunk_count": 123,
    "status": "indexed",
    "created_at": "2025-10-31T12:00:00.000Z",
    "indexed_at": "2025-10-31T12:01:30.000Z"
  }
}
```

#### DELETE /api/v1/papers/{id}

Delete a paper and all its associated data (metadata, chunks, vectors).

**Response:**

```json
{
  "success": true,
  "data": {
    "removed_vectors": 123,
    "removed_chunks": 123,
    "removed_paper": true
  }
}
```

#### GET /api/v1/papers/{id}/stats

Get statistics for a specific paper.

**Response:**

```json
{
  "success": true,
  "data": {
    "paper_id": "67234abc123def456789",
    "filename": "paper_1.pdf",
    "vector_count": 123,
    "chunk_count": 123,
    "indexed_at": "2025-10-31T12:01:30.000Z"
  }
}
```

### Query History & Analytics

#### GET /api/v1/queries/history

Get paginated query history.

**Query Parameters:**

- `limit`: Number of results (1-100, default: 20)
- `offset`: Skip N results (default: 0)

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "query_id_123",
        "question": "What methodology was used?",
        "paper_ids": ["paper_1", "paper_2"],
        "retrieval_time_ms": 45,
        "gen_time_ms": 1200,
        "total_time_ms": 1245,
        "confidence": 0.87,
        "rating": 5,
        "created_at": "2025-10-31T12:00:00.000Z"
      }
    ]
  }
}
```

#### PATCH /api/v1/queries/{id}/rating

Rate a previous query (1-5 stars).

**Request Body:**

```json
{
  "rating": 5
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "query_id_123",
    "rating": 5
  }
}
```

#### GET /api/v1/analytics/popular

Get popular questions and most referenced papers.

**Query Parameters:**

- `limit`: Number of results (1-100, default: 20)

**Response:**

```json
{
  "success": true,
  "data": {
    "popular_questions": [
      {
        "question": "What is the main contribution?",
        "count": 15
      }
    ],
    "popular_papers": [
      {
        "paper_id": "67234abc123def456789",
        "references": 42
      }
    ]
  }
}
```

### OpenAPI Specification

#### GET /openapi.json

Get the complete OpenAPI 3.0 specification for the API.

**Example:**

```bash
curl http://localhost:8000/openapi.json | jq
```

For complete API documentation with more examples, see [api_doc.md](./api_doc.md).

## Configuration

### Environment Variables

The system uses environment variables for configuration. Copy the example file:

```bash
cp infra/example.env .env
```

#### Backend Service Variables

| Variable                  | Default                     | Description                                     |
| ------------------------- | --------------------------- | ----------------------------------------------- |
| `API_PORT`                | `8000`                      | Port for backend API                            |
| `LOG_LEVEL`               | `info`                      | Log verbosity (trace, debug, info, warn, error) |
| `MONGO_URI`               | `mongodb://localhost:27017` | MongoDB connection string                       |
| `MONGO_DB`                | `rag`                       | MongoDB database name                           |
| `QDRANT_URL`              | `http://localhost:6333`     | Qdrant vector DB URL                            |
| `REDIS_URL`               | `redis://localhost:6379`    | Redis connection URL                            |
| `OLLAMA_BASE_URL`         | `http://localhost:11434`    | Ollama LLM server URL                           |
| `EMBEDDER_URL`            | `http://localhost:9100`     | Embedder service URL                            |
| `RATE_LIMIT_WINDOW_MS`    | `60000`                     | Rate limit window in milliseconds               |
| `RATE_LIMIT_MAX`          | `120`                       | Max requests per window                         |
| `SKIP_OLLAMA_READY_CHECK` | `false`                     | Skip Ollama check in readiness probe            |

#### Embedder Service Variables

| Variable                   | Default   | Description                            |
| -------------------------- | --------- | -------------------------------------- |
| `EMBEDDER_CORS_ORIGINS`    | `*`       | Allowed CORS origins (comma-separated) |
| `EMBEDDER_MAX_PAGES`       | `80`      | Max pages to process per PDF           |
| `EMBEDDER_MAX_TOTAL_CHARS` | `2000000` | Max total characters to extract        |
| `EMBEDDER_MAX_CHUNKS`      | `4000`    | Max chunks to generate per paper       |

#### Frontend Service Variables (Build-time)

| Variable             | Default                        | Description               |
| -------------------- | ------------------------------ | ------------------------- |
| `VITE_API_BASE`      | `http://localhost:8000/api/v1` | Backend API base URL      |
| `VITE_SERVICE_BASE`  | `http://localhost:8000`        | Backend service base URL  |
| `VITE_EMBEDDER_BASE` | `http://localhost:9100`        | Embedder service base URL |

### Docker Compose Variants

The project provides several docker-compose configurations for different environments:

- **`docker-compose.dependencies.yml`**: Only infrastructure services (MongoDB, Qdrant, Redis)
- **`docker-compose.linux.dev.yml`**: Development on Linux
- **`docker-compose.linux.prod.yml`**: Production on Linux
- **`docker-compose.mac-win.dev.yml`**: Development on macOS/Windows
- **`docker-compose.mac-win.prod.yml`**: Production on macOS/Windows

**Usage:**

```bash
# Start only dependencies for local development
docker compose -f infra/docker-compose.dependencies.yml up -d

# Start full stack (production)
docker compose -f infra/docker-compose.yml up -d

# Platform-specific (Linux development)
docker compose -f infra/docker-compose.linux.dev.yml up -d
```

## Development

### Backend Development

```bash
cd backend-service

# Install dependencies
bun install

# Run in development mode (with hot reload)
bun run dev

# Build for production
bun run build

# Run production build
bun run start

# Run tests
bun run test

# Lint code
bun run lint
```

### Embedder Development

```bash
cd embedder-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run in development mode
uvicorn app:app --reload --port 9100

# Run tests
pytest test_extract.py
pytest test_embed.py

# Force garbage collection (if needed)
curl -X POST http://localhost:9100/gc
```

### Frontend Development

```bash
cd frontend-service

# Install dependencies
bun install

# Run in development mode (with hot reload)
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Lint code
bun run lint
```

### Code Style and Conventions

- **TypeScript**: Strict mode enabled, no implicit any
- **Python**: PEP 8 style guide, type hints where applicable
- **Commits**: Conventional commit messages (feat:, fix:, docs:, etc.)
- **Imports**: Organized (external → internal → relative)
- **Error Handling**: Always catch and log errors appropriately

## Testing

### Backend Tests

The backend includes comprehensive test coverage using Vitest:

```bash
cd backend-service

# Run all tests
bun run test

# Run specific test file
bun test tests/query.test.ts

# Run tests in watch mode
bun test --watch

# Generate coverage report
bun test --coverage
```

**Test Files:**

- `config.test.ts`: Environment configuration
- `health.test.ts`: Health check endpoints
- `query.test.ts`: Query pipeline
- `papers.test.ts`: Paper management
- `ingest.test.ts`: Document ingestion
- `retrieval.test.ts`: Vector retrieval
- `history.test.ts`: Query history
- `rating.test.ts`: Rating functionality
- `popular.test.ts`: Analytics endpoints

### Embedder Tests

```bash
cd embedder-service
source venv/bin/activate

# Run extraction tests
pytest test_extract.py -v

# Run embedding tests
pytest test_embed.py -v

# Run all tests
pytest -v
```

### Integration Testing

Test the full pipeline:

```bash
# 1. Upload a paper
PAPER_ID=$(curl -s -X POST http://localhost:8000/api/v1/papers/upload \
  -F "file=@sample_papers/paper_1.pdf" | jq -r '.data.paper_id')

# 2. Wait for indexing (check status)
curl -s http://localhost:8000/api/v1/papers/$PAPER_ID | jq '.data.status'

# 3. Query the paper
curl -s -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"What is the main contribution?\",\"paper_ids\":[\"$PAPER_ID\"]}" \
  | jq '.data.answer'
```

### Manual Testing Checklist

- [ ] Upload PDF and verify extraction
- [ ] Check paper appears in list with status "extracted"
- [ ] Wait for status to change to "indexed"
- [ ] Query the indexed paper
- [ ] Verify citations include paper title, section, page
- [ ] Test query filtering by paper IDs
- [ ] Check query history is saved
- [ ] Test rating a query
- [ ] View analytics for popular questions
- [ ] Delete a paper and verify vectors removed
- [ ] Test error cases (invalid PDF, missing fields)

### Debug Mode

Enable verbose logging:

```bash
# Backend
LOG_LEVEL=debug bun run dev

# Embedder
LOG_LEVEL=debug uvicorn app:app --reload --port 9100

# Check logs in Docker
docker compose -f infra/docker-compose.yml logs -f --tail=100 backend
```

### Health Check Script

```bash
#!/bin/bash
echo "=== System Health Check ==="

echo "Backend API:"
curl -s http://localhost:8000/health/healthz | jq

echo -e "\nBackend Readiness:"
curl -s http://localhost:8000/health/readyz | jq

echo -e "\nEmbedder:"
curl -s http://localhost:9100/healthz | jq

echo -e "\nQdrant:"
curl -s http://localhost:6333/collections | jq

echo -e "\nOllama:"
curl -s http://localhost:11434/api/tags | jq

echo -e "\nMongoDB:"
mongosh $MONGO_URI --eval "db.adminCommand('ping')" --quiet
```

### Getting Help

If you're stuck:

1. Check logs: `docker compose logs -f [service_name]`
2. Verify configuration: Review `.env` file
3. Test individual services: Use curl commands from API documentation
4. Search issues: Check GitHub issues for similar problems
5. Open an issue: Provide logs, configuration, and steps to reproduce

---

## Appendix

### Embedding Model Details

**Model:** BAAI/bge-small-en-v1.5

- **Dimensions:** 384
- **Max Sequence Length:** 512 tokens
- **Use Case:** General-purpose semantic search
- **Performance:** 1000+ chunks/min on CPU
- **Normalization:** L2 normalization enabled
- **Similarity Metric:** Cosine similarity (via normalized dot product)

### Chunking Strategy

**Approach:** Fixed-size with overlap

- **Chunk Size:** 500 tokens (~375 words)
- **Overlap:** 50 tokens (~37 words)
- **Boundary:** Split on whitespace, preserve words
- **Section Tracking:** Each chunk tagged with section name
- **Page Tracking:** Each chunk tagged with page number

**Rationale:**

- 500 tokens fits within embedding model context (512)
- Overlap prevents information loss at boundaries
- Section awareness improves retrieval precision
- Page numbers enable accurate citations

### Re-ranking Strategy

**Section-Based Weighting:**

| Section      | Weight | Rationale                                              |
| ------------ | ------ | ------------------------------------------------------ |
| Methods      | 1.2×   | Technical content, high relevance for "how" questions  |
| Results      | 1.1×   | Findings and data, high relevance for "what" questions |
| Discussion   | 1.05×  | Analysis and interpretation                            |
| Introduction | 1.0×   | Context and background                                 |
| Conclusion   | 1.0×   | Summary and implications                               |
| Abstract     | 0.9×   | Brief overview, less detailed                          |
| Unknown      | 0.9×   | Fallback for unclassified sections                     |
| References   | 0.8×   | Citations, typically less relevant                     |

### Prompt Engineering

**Template Structure:**

```xml
<context>
  <chunk>
    <meta paper_id="..." paper_title="..." section="..." page="..."/>
    [chunk text]
  </chunk>
  ...
</context>

You are a research assistant named SageAI. Answer the question using ONLY the provided context.
Use markdown to format your answer.
Cite sources explicitly in the form [paper_title, section, page].
If the answer is not covered by the context, say you are uncertain.

<question>[user question]</question>
```

**Design Decisions:**

- XML structure for clarity and LLM parsing
- Explicit instructions to cite sources
- Guardrail for uncertain cases
- Markdown formatting for readability
- Role definition (research assistant)

### Database Schema

**MongoDB Collections:**

**`papers` collection:**

```json
{
  "_id": ObjectId,
  "filename": "paper_1.pdf",
  "metadata": {
    "title": "Paper Title",
    "authors": "Author Names",
    "year": "2024",
    "pages": 12
  },
  "sections": [
    {
      "name": "Abstract",
      "start_page": 1,
      "end_page": 1
    }
  ],
  "chunk_count": 123,
  "status": "indexed",  // "extracted" | "indexed"
  "created_at": ISODate,
  "indexed_at": ISODate
}
```

**`chunks` collection:**

```json
{
  "_id": ObjectId,
  "paper_id": "paper_object_id",
  "id": "c_0",
  "text": "Chunk text content...",
  "section": "Introduction",
  "page": 1,
  "order": 0
}
```

**`queries` collection:**

```json
{
  "_id": ObjectId,
  "question": "What methodology was used?",
  "normalized_question": "what methodology used",
  "paper_ids": ["paper_id_1"],
  "answer": "The methodology...",
  "retrieval_time_ms": 45,
  "gen_time_ms": 1200,
  "total_time_ms": 1245,
  "top_sources": [
    {
      "paper_id": "...",
      "section": "Methods",
      "page": 3,
      "score": 0.89
    }
  ],
  "citations": [...],
  "sources_used": ["Paper Title"],
  "confidence": 0.87,
  "rating": null,  // 1-5 or null
  "created_at": ISODate
}
```

**Qdrant Collection (`papers_chunks`):**

```json
{
  "id": "unique_vector_id",
  "vector": [0.123, 0.456, ...],  // 384 dimensions
  "payload": {
    "paper_id": "mongo_paper_id",
    "paper_title": "Paper Title",
    "section": "Methods",
    "page": 3,
    "chunk_index": 5,
    "model": "BAAI/bge-small-en-v1.5",
    "vector_dim": 384,
    "created_at": "2025-10-31T12:00:00.000Z"
  }
}
```
