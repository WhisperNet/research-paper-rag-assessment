from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import io
import re
import fitz  # PyMuPDF
from typing import List, Dict, Any


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
    r"^abstract$",
    r"^introduction$",
    r"^related work$",
    r"^background$",
    r"^methods?$",
    r"^methodology$",
    r"^approach$",
    r"^experiments?$",
    r"^results?$",
    r"^discussion$",
    r"^conclusion[s]?$",
    r"^references$",
]


def detect_sections(page_texts: List[str]) -> List[Section]:
    sections: List[Section] = []
    current_section = Section(name="Unknown", start_page=1, end_page=len(page_texts))
    section_indices: List[int] = []

    for idx, text in enumerate(page_texts, start=1):
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if not lines:
            continue
        first_lines = lines[:10]
        for line in first_lines:
            lower = re.sub(r"[^a-z ]", "", line.lower())
            if any(re.match(p, lower) for p in SECTION_PATTERNS):
                section_indices.append(idx)
                break

    if not section_indices:
        return [current_section]

    # Build sections from indices
    names: List[str] = []
    for idx in section_indices:
        # Use the first non-empty line as the section name on that page
        lines = [l.strip() for l in page_texts[idx - 1].splitlines() if l.strip()]
        name = lines[0] if lines else f"Section {idx}"
        names.append(name)

    for i, start in enumerate(section_indices):
        end = (section_indices[i + 1] - 1) if i + 1 < len(section_indices) else len(page_texts)
        sections.append(Section(name=names[i], start_page=start, end_page=end))

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

    sections = detect_sections(page_texts)

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
        combined_text = "\n".join(page_texts[section.start_page - 1 : section.end_page])
        for order, part in enumerate(chunk_text(combined_text), start=0):
            chunks.append(
                Chunk(
                    id=f"c_{chunk_id}",
                    text=part,
                    section=section.name,
                    page=section.start_page,
                    order=order,
                )
            )
            chunk_id += 1

    response = ExtractResponse(metadata=metadata, sections=sections, chunks=chunks)
    return JSONResponse(content=response.model_dump())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9100)
