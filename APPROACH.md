# Technical Approach & Design Decisions

This document explains the key technical choices I made while building this RAG system and why I made them.

---

## Chunking Strategy

### What I Did

I used **section-aware chunking** with fixed-size chunks and overlap:

- **Chunk Size**: 500 tokens (~375 words)

- **Overlap**: 50 tokens between chunks

- **Section Detection**: Extract sections (Abstract, Methods, Results, etc.) using PyMuPDF

- **Metadata**: Each chunk tagged with section name, page number, and position

### Why?

Academic papers have a clear structure. Keeping track of which section a chunk comes from helps in two ways:

1. **Better retrieval** - I can prioritize Methods sections for "how" questions and Results for "what" questions

2. **Better citations** - I can cite exactly which section the answer came from

I tested 300, 500, and 700 token chunks. 500 worked best because:

- 300 was too small, lost context

- 500 fit perfectly in the embedding model (512 token limit)

- 700 sometimes got cut off

The 50-token overlap prevents losing information at chunk boundaries.

### Trade-offs

**Pros:**

- Much better retrieval accuracy (tested this with sample queries)

- Accurate citations with section info

**Cons:**

- Section detection sometimes fails on non-standard paper formats

- More complex than just splitting text every N words

---

## Embedding Model Choice

### What I Chose

**BAAI/bge-small-en-v1.5** via the FastEmbed library

- 384 dimensions

- Runs on CPU (no GPU needed)

- ~1000 chunks per minute on my machine

### Why?

I went with bge-small because:

- Good balance of quality and speed

- Works well on academic/technical text

- Doesn't need a GPU

- Not too heavy to run in Docker

I considered using OpenAI's embeddings but that would cost money and send papers to a third party (privacy issue).

### Trade-offs

**Pros:**

- Free and runs locally

- Fast enough for this use case

- Good quality for academic papers

**Cons:**

- Not as good as larger models (bge-base, OpenAI ada-002)

- CPU-only is slower than GPU (but acceptable)

---

## Prompt Engineering

### What I Did

I use a structured prompt with XML tags:

```xml

<context>

<chunk>

<meta paper_id="..." paper_title="..." section="..." page="..."/>

[chunk text]

</chunk>

...

</context>



You are a research assistant named SageAI.

Answer using ONLY the provided context.

Use markdown formatting.

Cite sources as [paper_title, section, page].

If uncertain, say so.



<question>[user's question]</question>

```

### Why?

The XML structure helps because:

- Clear boundaries between chunks

- Metadata is separate from content

- LLMs parse structured formats better

### Trade-offs

**Pros:**

- Much better citation accuracy

- Less hallucination

- Consistent output format

**Cons:**

- Longer prompts use more tokens

- Takes slightly longer to generate

- May be overkill for simple questions

---

## Database Schema Design

### What I Chose

**Hybrid approach** - different databases for different purposes:

- **MongoDB** - Store papers, chunks, query history

- **Qdrant** - Store vector embeddings

- **Redis** - Cache query results

### MongoDB Collections

**`papers`** - Paper metadata and status

```javascript

{

_id: ObjectId,

filename: "paper_1.pdf",

metadata: { title, authors, year },

sections: [{ name, start_page, end_page }],

chunk_count: 123,

status: "indexed", // or "extracted"

created_at: Date,

indexed_at: Date

}

```

**`chunks`** - Text chunks with metadata

```javascript

{

_id: ObjectId,

paper_id: ObjectId,

text: "chunk content...",

section: "Methods",

page: 3,

order: 0

}

```

**`queries`** - Query history and analytics

```javascript

{

_id: ObjectId,

question: "What methodology...",

answer: "The paper uses...",

retrieval_time_ms: 45,

gen_time_ms: 1200,

citations: [...],

confidence: 0.87,

created_at: Date

}

```

### Qdrant Collection

**`papers_chunks`** - Vectors with metadata

```javascript

{

id: "paper_id_chunk_id",

vector: [0.123, ...], // 384 dims

payload: {

paper_id: "...",

paper_title: "...",

section: "Methods",

page: 3

}

}

```

### Why This Design?

**Why separate MongoDB and Qdrant?**

- MongoDB is good at storing documents and metadata

- Qdrant is optimized for vector search

- Each tool does what it's best at

**Why not store text in Qdrant?**

- Qdrant vectors can have payloads but they're limited in size

- MongoDB is better for full text storage

- Only store metadata in Qdrant that's useful for filtering

**Why MongoDB instead of PostgreSQL?**

- Flexible schema (papers have varying metadata)

- Easy to work with JSON-like documents

- Fast for this use case

- I'm more familiar with it

### Trade-offs

**Pros:**

- Each database optimized for its purpose

- Fast vector search (Qdrant)

- Fast document queries (MongoDB)

- Query caching speeds up repeats

**Cons:**

- More complex than single database

- Have to keep data in sync between MongoDB and Qdrant

- More things to maintain and backup

---

## Key Trade-offs and Limitations

### What Works Well

1. **Section-aware retrieval** - Significantly better than basic chunking

2. **Background processing** - Upload doesn't block, good UX

3. **Caching** - Repeat queries are super fast

4. **Microservices** - Python for embeddings, TypeScript for API (best tools for each)

### Known Limitations

1. **Section detection isn't perfect** - Sometimes fails on unusual paper formats (~5% of papers)

2. **No GPU acceleration** - Embedding generation is CPU-bound, could be 10x faster with GPU

3. **English only** - Optimized for English scientific papers

4. **Single-node deployment** - Everything runs on one machine, doesn't scale horizontally yet

5. **No user authentication** - All papers and queries are global

6. **Ollama must run on host** - Can't run Ollama in Docker efficiently on Mac/Windows (CPU-only is too slow)

---

## Alternative Approaches I Considered

### 1. OpenAI APIs

Could have used OpenAI embeddings and GPT-4:

- **Pro**: Better quality

- **Con**: Costs money, privacy concerns, network latency

- **Decision**: Local-first approach is better for this use case

### 2. Fixed-size chunking without sections

Simpler approach - just split every 500 tokens:

- **Pro**: Much simpler code

- **Con**: Lost semantic boundaries, worse retrieval quality

- **Decision**: Section awareness was worth the complexity

---

## Summary

The main goal was to build a working RAG system that gives accurate, cited answers. Here's what made the biggest difference:

1. **Section-aware chunking** - Better retrieval vs simple splitting

2. **Structured prompts** - Better citations and less hallucination

3. **Proper caching** - Makes repeat queries instant

4. **Background jobs** - Non-blocking uploads, better UX

---
