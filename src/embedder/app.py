from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import io
import re
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional
import statistics


app = FastAPI(title="Embedder Service")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "embedder"}


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


SECTION_PATTERNS = [
    r"^(?:\d+(?:\.\d+)*\s+)?abstract$",
    r"^(?:\d+(?:\.\d+)*\s+)?summary$",
    r"^(?:\d+(?:\.\d+)*\s+)?introduction$",
    r"^(?:\d+(?:\.\d+)*\s+)?literature\s+review$",
    r"^(?:\d+(?:\.\d+)*\s+)?related\s+work$",
    r"^(?:\d+(?:\.\d+)*\s+)?background$",
    r"^(?:\d+(?:\.\d+)*\s+)?materials?\s+and\s+methods$",
    r"^(?:\d+(?:\.\d+)*\s+)?methods?$",
    r"^(?:\d+(?:\.\d+)*\s+)?methodology$",
    r"^(?:\d+(?:\.\d+)*\s+)?approach$",
    r"^(?:\d+(?:\.\d+)*\s+)?experimental\s+setup$",
    r"^(?:\d+(?:\.\d+)*\s+)?experiments?$",
    r"^(?:\d+(?:\.\d+)*\s+)?results?$",
    r"^(?:\d+(?:\.\d+)*\s+)?results\s+and\s+discussion$",
    r"^(?:\d+(?:\.\d+)*\s+)?discussion$",
    r"^(?:\d+(?:\.\d+)*\s+)?evaluation$",
    r"^(?:\d+(?:\.\d+)*\s+)?conclusions?$",
    r"^(?:\d+(?:\.\d+)*\s+)?acknowledg?ments?$",
    r"^(?:\d+(?:\.\d+)*\s+)?references$",
    r"^(?:\d+(?:\.\d+)*\s+)?bibliography$",
]


def _normalize_heading(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^[\d\.\s]+", "", cleaned)  # drop leading numbers like "1.2 "
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def _page_lines_with_style(page: "fitz.Page") -> List[Dict[str, Any]]:
    data: List[Dict[str, Any]] = []
    try:
        d = page.get_text("dict")
    except Exception:
        return data
    for block in d.get("blocks", []):
        for line in block.get("lines", []):
            texts: List[str] = []
            sizes: List[float] = []
            bolds: List[bool] = []
            for span in line.get("spans", []):
                t = (span.get("text") or "").strip()
                if not t:
                    continue
                texts.append(t)
                try:
                    sizes.append(float(span.get("size") or 0))
                except Exception:
                    sizes.append(0.0)
                bolds.append(bool(span.get("flags", 0) & 20))
            if not texts:
                continue
            text = _normalize_heading(" ".join(texts))
            size = max(sizes) if sizes else 0.0
            bold = any(bolds)
            bbox = line.get("bbox", [0, 0, 0, 0])
            y = float(bbox[1])
            x = float(bbox[0])
            data.append({"text": text, "size": size, "bold": bold, "y": y, "x": x})
    return data


def _is_heading_candidate(line: Dict[str, Any], size_threshold: float) -> bool:
    text = line.get("text", "")
    if not text or len(text.split()) > 12:
        return False
    if re.search(r"(figure|table|algorithm)\s+\d+", text, re.I):
        return False
    if line.get("size", 0.0) >= size_threshold or line.get("bold", False):
        return True
    return bool(re.match(r"^\d+(?:\.\d+)*\s+[A-Z][A-Za-z].+", text))


def _abstract_keywords_heuristic(lines_page1: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    hits: List[Dict[str, Any]] = []
    for ln in lines_page1:
        if re.match(r"^abstract[:\s]", ln.get("text", ""), re.I):
            hits.append({"text": "Abstract", "y": ln.get("y", 0.0)})
        if re.match(r"^keywords?[:\s]", ln.get("text", ""), re.I):
            hits.append({"text": "Keywords", "y": ln.get("y", 0.0)})
    return hits


def detect_sections_layout(doc: "fitz.Document", page_texts: List[str]) -> List[Section]:
    toc_candidates: List[Dict[str, Any]] = []
    try:
        toc = doc.get_toc(simple=True) or []
        for _lvl, title, p in toc:
            norm = _normalize_heading(title or "")
            if not norm:
                continue
            lower = re.sub(r"[^a-z ]", "", norm.lower())
            if any(re.match(pat, lower) for pat in SECTION_PATTERNS):
                toc_candidates.append({"page": int(p), "y": 0.0, "name": norm})
    except Exception:
        pass

    layout_candidates: List[Dict[str, Any]] = []
    for i in range(len(page_texts)):
        page = doc.load_page(i)
        lines = _page_lines_with_style(page)
        if not lines:
            continue
        sizes = [ln["size"] for ln in lines if ln.get("size", 0) > 0]
        if not sizes:
            continue
        try:
            p90 = statistics.quantiles(sizes, n=10)[-1]
        except Exception:
            p90 = max(sizes)
        size_thresh = max(p90, statistics.median(sizes) + 2.0)
        for ln in lines:
            if _is_heading_candidate(ln, size_thresh):
                name = _normalize_heading(ln["text"])
                lower = re.sub(r"[^a-z ]", "", name.lower())
                if any(re.match(pat, lower) for pat in SECTION_PATTERNS) or len(name.split()) <= 8:
                    layout_candidates.append({"page": i + 1, "y": ln["y"], "name": name})
        if i == 0:
            for hit in _abstract_keywords_heuristic(lines):
                layout_candidates.append({"page": 1, "y": hit["y"], "name": hit["text"]})

    candidates = layout_candidates or toc_candidates
    if not candidates:
        return [Section(name="Unknown", start_page=1, end_page=len(page_texts))]

    candidates.sort(key=lambda t: (t["page"], t["y"]))
    sections: List[Section] = []
    for idx, curr in enumerate(candidates):
        end = (candidates[idx + 1]["page"] - 1) if idx + 1 < len(candidates) else len(page_texts)
        name = curr["name"]
        if sections and name.lower() in {"keywords"}:
            sections[-1].end_page = max(sections[-1].end_page, curr["page"])
            continue
        sections.append(Section(name=name, start_page=int(curr["page"]), end_page=end))

    cleaned: List[Section] = []
    last_end = 0
    for s in sections:
        if s.end_page < s.start_page:
            continue
        if s.start_page <= last_end:
            s.start_page = last_end + 1
        last_end = s.end_page
        cleaned.append(s)

    return cleaned
    sections: List[Section] = []
    # 1) Prefer Table of Contents if available
    try:
        toc = doc.get_toc(simple=True) or []
    except Exception:
        toc = []

    candidates: List[Section] = []
    for entry in toc:
        try:
            _level, title, page_num = entry  # page_num is 1-based
            norm = _normalize_heading(title)
            lower = re.sub(r"[^a-z ]", "", norm.lower())
            if any(re.match(p, lower) for p in SECTION_PATTERNS):
                candidates.append(Section(name=norm, start_page=int(page_num), end_page=int(page_num)))
        except Exception:
            continue

    # 2) If no ToC-based matches, use heuristic scanning of full page text
    numbered_heading = re.compile(r"^(\d+(?:\.\d+)*)\s+([A-Z][A-Za-z][A-Za-z\s\-]{2,})$")
    if not candidates:
        for idx, text in enumerate(page_texts, start=1):
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            if not lines:
                continue
            hit_on_page = False
            for line in lines:
                norm = _normalize_heading(line)
                lower = re.sub(r"[^a-z ]", "", norm.lower())
                if any(re.match(p, lower) for p in SECTION_PATTERNS):
                    candidates.append(Section(name=norm, start_page=idx, end_page=idx))
                    hit_on_page = True
                    break
                # Accept generic numbered headings with short titles (<= 8 words)
                m = numbered_heading.match(line.strip())
                if m:
                    title = _normalize_heading(m.group(2))
                    if 1 <= len(title.split()) <= 8 and not re.search(r"figure|table|algorithm", title.lower()):
                        candidates.append(Section(name=title, start_page=idx, end_page=idx))
                        hit_on_page = True
                        break
            if hit_on_page:
                continue

    if not candidates:
        return [Section(name="Unknown", start_page=1, end_page=len(page_texts))]

    # Merge contiguous and finalize ranges
    candidates.sort(key=lambda s: s.start_page)
    for i, curr in enumerate(candidates):
        end = (candidates[i + 1].start_page - 1) if i + 1 < len(candidates) else len(page_texts)
        sections.append(Section(name=curr.name, start_page=curr.start_page, end_page=end))

    return sections


def chunk_text(text: str, max_chars: int = 1800, overlap: int = 200) -> List[str]:
    if len(text) <= max_chars:
        return [text]
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        # try to break on sentence end
        slice_text = text[start:end]
        last_period = slice_text.rfind(". ")
        if last_period != -1 and end != len(text):
            end = start + last_period + 2
        chunks.append(text[start:end].strip())
        if end == len(text):
            break
        start = max(0, end - overlap)
    return chunks


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    try:
        content = await file.read()
        doc = fitz.open(stream=io.BytesIO(content), filetype="pdf")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")

    page_texts: List[str] = []
    for page in doc:
        try:
            page_texts.append(page.get_text("text"))
        except Exception:
            page_texts.append("")

    sections = detect_sections_layout(doc, page_texts)

    # Simple metadata derivation
    metadata = {
        "title": doc.metadata.get("title") or file.filename,
        "authors": doc.metadata.get("author") or "",
        "year": doc.metadata.get("creationDate") or "",
        "pages": len(page_texts),
        "filename": file.filename,
    }

    chunks: List[Chunk] = []
    chunk_id = 0
    for section in sections:
        for page_num in range(section.start_page, section.end_page + 1):
            page_text = page_texts[page_num - 1]
            # skip empty pages gracefully
            if not page_text.strip():
                continue
            for part in chunk_text(page_text):
                chunks.append(
                    Chunk(
                        id=f"c_{chunk_id}",
                        text=part,
                        section=section.name,
                        page=page_num,
                        order=chunk_id,
                    )
                )
                chunk_id += 1

    response = ExtractResponse(metadata=metadata, sections=sections, chunks=chunks)
    return JSONResponse(content=response.model_dump())


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
        return EmbedResponse(model=str(req.model), vectors=vectors, dim=dim)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9100)
