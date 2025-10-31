from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import io
import re
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional
import os
import gc


app = FastAPI(title="Embedder Service")

# --- CORS ---
try:
    from fastapi.middleware.cors import CORSMiddleware

    allowed_origins = os.getenv("EMBEDDER_CORS_ORIGINS", "*").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in allowed_origins if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
except Exception:
    pass


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "embedder"}


@app.post("/gc")
def force_gc():
    """Force garbage collection to free memory."""
    collected = gc.collect()
    return {"collected": collected, "message": "GC completed"}


class Chunk(BaseModel):
    id: str
    text: str
    section: str
    page: int
    order: int


class Section(BaseModel):
    name: str
    start_page: int
    end_page: int


class ExtractResponse(BaseModel):
    metadata: Dict[str, Any]
    sections: List[Section]
    chunks: List[Chunk]

def _normalize_heading(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^[\d\.\s]+", "", cleaned)  # drop leading numbers like "1.2 "
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def _extract_title_from_first_page(doc: "fitz.Document") -> Optional[str]:
    """Heuristic title extractor: choose the largest-font line(s) on page 1.
    Returns a single-line title or None if not found.
    """
    try:
        page = doc.load_page(0)
    except Exception:
        return None
    try:
        pd = page.get_text("dict")
    except Exception:
        return None

    lines: List[Dict[str, Any]] = []
    for block in pd.get("blocks", []):
        for line in block.get("lines", []):
            texts: List[str] = []
            sizes: List[float] = []
            for span in line.get("spans", []):
                t = (span.get("text") or "").strip()
                if not t:
                    continue
                texts.append(t)
                try:
                    sizes.append(float(span.get("size") or 0))
                except Exception:
                    sizes.append(0.0)
            if not texts:
                continue
            text = " ".join(texts)
            size = max(sizes) if sizes else 0.0
            bbox = line.get("bbox", [0, 0, 0, 0])
            y = float(bbox[1])
            # Filter out obvious non-title lines
            lower = text.lower()
            if (
                len(text) < 6
                or lower.startswith("abstract")
                or lower.startswith("keywords")
                or lower.startswith("received:")
                or lower.startswith("revised:")
                or lower.startswith("accepted:")
                or "doi" in lower
                or lower.startswith("copyright")
                or lower.startswith("licensee")
            ):
                continue
            lines.append({"text": text, "size": size, "y": y})

    if not lines:
        return None
    # Sort lines by size desc, then y asc
    sorted_lines = sorted(lines, key=lambda l: (-l["size"], l["y"]))
    # Pick the first line with at least 4 words; fallback to the largest
    chosen = None
    for l in sorted_lines:
        if len(l["text"].split()) >= 4:
            chosen = l
            break
    if not chosen:
        chosen = sorted_lines[0]

    chosen_size = chosen["size"]
    # Allow small tolerance to include second line of multi-line titles
    candidates = [l for l in lines if l["size"] >= chosen_size - 0.5]
    candidates.sort(key=lambda l: l["y"]) 
    title_lines: List[str] = []
    for l in candidates:
        title_lines.append(l["text"].strip())
        if len(title_lines) == 2:
            break
    title = " ".join(title_lines).strip()
    # Final cleanup
    title = re.sub(r"\s+", " ", title)
    return title if title else None


# Compile regexes once at module level
_NUMBERED_HEADING_RE = re.compile(
    r"^\s*\d+(?:\.\d+){0,5}\.\s{0,3}(?!Figure\b|Table\b|Algorithm\b)([A-Z][^\n]{0,120})$",
    re.M,
)
_COMMON_HEADING_RE = re.compile(
    r"^(Abstract|Introduction|Conclusions?|References?|Methodology|Results|Discussion(?: and Conclusions)?|Background|Future Work|SUPPLEMENTAL INFORMATION|ACKNOWLEDG[E]?MENTS|DECLARATION OF INTERESTS|Keywords)\b.*$",
    re.I | re.M,
)


def detect_headings_in_text(txt: str) -> List[str]:
    """Detect section headings in chunk text."""
    names: List[str] = []
    for m in _NUMBERED_HEADING_RE.finditer(txt):
        name = _normalize_heading(m.group(1))
        names.append(name)
    for m in _COMMON_HEADING_RE.finditer(txt):
        raw = m.group(1)
        name = raw[:1].upper() + raw[1:]
        names.append(_normalize_heading(name))
    return names


def chunk_text(text: str, max_chars: int = 1800, overlap: int = 200) -> List[str]:
    if len(text) <= max_chars:
        return [text]
    chunks: List[str] = []
    start = 0
    max_iterations = len(text) // 10 + 100  # safety valve
    iterations = 0
    while start < len(text):
        iterations += 1
        if iterations > max_iterations:
            # Force break to prevent infinite loop
            break
        end = min(start + max_chars, len(text))
        # try to break on sentence end
        slice_text = text[start:end]
        last_period = slice_text.rfind(". ")
        if last_period != -1 and end != len(text):
            end = start + last_period + 2
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        # Ensure forward progress - require minimum step of 100 chars or half max_chars
        new_start = end - overlap
        min_step = min(100, max_chars // 2)
        if new_start <= start:
            new_start = start + min_step
        # If we can't make meaningful progress, break to avoid tiny chunks
        if new_start >= len(text):
            break
        start = new_start
    return chunks


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    doc = None
    try:
        content = await file.read()
        doc = fitz.open(stream=io.BytesIO(content), filetype="pdf")
        # Release content buffer immediately
        del content
    except Exception as e:  # noqa: BLE001
        if doc:
            try:
                doc.close()
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")

    # Resource guards
    MAX_PAGES = int(os.getenv("EMBEDDER_MAX_PAGES", "80"))
    MAX_TOTAL_CHARS = int(os.getenv("EMBEDDER_MAX_TOTAL_CHARS", "2000000"))
    MAX_CHUNKS = int(os.getenv("EMBEDDER_MAX_CHUNKS", "4000"))

    # Extract metadata before closing doc
    detected_title = _extract_title_from_first_page(doc)
    metadata = {
        "title": detected_title or (doc.metadata.get("title") or file.filename),
        "authors": doc.metadata.get("author") or "",
        "year": doc.metadata.get("creationDate") or "",
        "filename": file.filename,
    }
    
    page_texts: List[str] = []
    total_chars = 0
    pages_processed = 0
    try:
        for page in doc:
            if pages_processed >= MAX_PAGES:
                break
            try:
                txt = page.get_text("text")
            except Exception:
                txt = ""
            page_texts.append(txt)
            total_chars += len(txt)
            pages_processed += 1
            if total_chars > MAX_TOTAL_CHARS:
                break
    finally:
        try:
            doc.close()
        except Exception:
            pass
        # Explicit cleanup
        doc = None
        gc.collect()
    
    # Add page count to metadata
    metadata["pages"] = len(page_texts)

    # ---------------- Regex-driven section detection over chunks ----------------
    chunks: List[Dict] = []
    chunk_id = 0
    current_section = "Unknown"
    in_references = False

    for page_num, page_text in enumerate(page_texts, start=1):
        if not page_text.strip():
            continue
        for part in chunk_text(page_text):
            if len(chunks) >= MAX_CHUNKS:
                break
            if not in_references:
                found = detect_headings_in_text(part)
                if found:
                    # first match applies to this chunk
                    section_for_this = found[0]
                    # last match becomes the section for following chunks, except Keywords
                    last = found[-1]
                    last_lower = last.lower()
                    if last_lower != "keywords":
                        current_section = last
                    if last_lower in {"references", "reference"}:
                        in_references = True
                else:
                    section_for_this = current_section
            else:
                # Once in references, freeze section to References
                current_section = "References"
                section_for_this = current_section

            chunks.append({
                "id": f"c_{chunk_id}",
                "text": part,
                "section": section_for_this or "Unknown",
                "page": page_num,
                "order": chunk_id,
            })
            chunk_id += 1

    # Derive sections from chunk stream by grouping consecutive chunks with same section
    sections: List[Section] = []
    if chunks:
        cur_name = chunks[0]["section"]
        start_page = chunks[0]["page"]
        last_page = chunks[0]["page"]
        for ch in chunks[1:]:
            if ch["section"] != cur_name:
                sections.append({"name": cur_name, "start_page": start_page, "end_page": last_page})
                cur_name = ch["section"]
                start_page = ch["page"]
            last_page = ch["page"]
        sections.append({"name": cur_name, "start_page": start_page, "end_page": last_page})

    # chunks already built above with detected sections
    # metadata was extracted earlier before doc close

    response = {"metadata": metadata, "sections": sections, "chunks": chunks}
    
    # Clean up large intermediate structures
    page_texts.clear()
    gc.collect()
    
    return JSONResponse(content=response)


# ----------------- Embedding endpoint -----------------
from pydantic import Field
from functools import lru_cache


class EmbedRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = Field(default="BAAI/bge-small-en-v1.5")
    normalize: Optional[bool] = Field(default=True)


class EmbedResponse(BaseModel):
    model: str
    vectors: List[List[float]]
    dim: int


@lru_cache(maxsize=1)
def get_model(name: str):
    from fastembed import TextEmbedding  # lazy import

    return TextEmbedding(model_name=name)


@app.post("/embed")
async def embed(req: EmbedRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="texts is required and cannot be empty")
    try:
        model = get_model(req.model or "BAAI/bge-small-en-v1.5")
        # fastembed returns an iterator of embeddings; collect into list
        vectors_iter = model.embed(req.texts, normalize=bool(req.normalize))
        vectors = [list(v) for v in vectors_iter]
        dim = len(vectors[0])
        response = EmbedResponse(model=str(req.model), vectors=vectors, dim=dim)
        
        # Clean up
        del vectors
        del vectors_iter
        gc.collect()
        
        return response
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9100)
