from __future__ import annotations

import gc
import io
import os
from functools import lru_cache
from typing import Dict, List

import fitz  # PyMuPDF
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

try:
    from .core.pdf import extract_title_from_first_page
    from .core.text import chunk_text, detect_headings_in_text
    from .models import EmbedRequest, EmbedResponse, ExtractResponse, Section
except Exception:
    # Support running as a script module (no package context)
    from core.pdf import extract_title_from_first_page  # type: ignore
    from core.text import chunk_text, detect_headings_in_text  # type: ignore
    from models import EmbedRequest, EmbedResponse, ExtractResponse, Section  # type: ignore


router = APIRouter()


@router.get("/healthz")
def healthz():
    return {"status": "ok", "service": "embedder"}


@router.post("/gc")
def force_gc():
    collected = gc.collect()
    return {"collected": collected, "message": "GC completed"}


@router.post("/extract")
async def extract(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    doc = None
    try:
        content = await file.read()
        doc = fitz.open(stream=io.BytesIO(content), filetype="pdf")
        del content
    except Exception as e:  # noqa: BLE001
        if doc:
            try:
                doc.close()
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")

    MAX_PAGES = int(os.getenv("EMBEDDER_MAX_PAGES", "80"))
    MAX_TOTAL_CHARS = int(os.getenv("EMBEDDER_MAX_TOTAL_CHARS", "2000000"))
    MAX_CHUNKS = int(os.getenv("EMBEDDER_MAX_CHUNKS", "4000"))

    detected_title = extract_title_from_first_page(doc)
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
        doc = None
        gc.collect()

    metadata["pages"] = len(page_texts)

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
                    section_for_this = found[0]
                    last = found[-1]
                    last_lower = last.lower()
                    if last_lower != "keywords":
                        current_section = last
                    if last_lower in {"references", "reference"}:
                        in_references = True
                else:
                    section_for_this = current_section
            else:
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

    response = {"metadata": metadata, "sections": sections, "chunks": chunks}
    page_texts.clear()
    gc.collect()
    return JSONResponse(content=response)


@lru_cache(maxsize=1)
def get_model(name: str):
    from fastembed import TextEmbedding  # lazy import
    return TextEmbedding(model_name=name)


@router.post("/embed")
async def embed(req: EmbedRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="texts is required and cannot be empty")
    try:
        model = get_model(req.model or "BAAI/bge-small-en-v1.5")
        vectors_iter = model.embed(req.texts, normalize=bool(req.normalize))
        vectors = [list(v) for v in vectors_iter]
        dim = len(vectors[0])
        response = EmbedResponse(model=str(req.model), vectors=vectors, dim=dim)
        del vectors
        del vectors_iter
        gc.collect()
        return response
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")


