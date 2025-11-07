from __future__ import annotations

from typing import Any, Dict, List, Optional


def extract_title_from_first_page(doc: "fitz.Document") -> Optional[str]:
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
    import re as _re
    title = " ".join(title_lines).strip()
    title = _re.sub(r"\s+", " ", title)
    return title if title else None


