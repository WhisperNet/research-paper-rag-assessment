from __future__ import annotations

import re
from typing import List, Optional


def _normalize_heading(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^[\d\.\s]+", "", cleaned)  # drop leading numbers like "1.2 "
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


# Compile regexes once at module load
_NUMBERED_HEADING_RE = re.compile(
    r"^\s*\d+(?:\.\d+){0,5}\.\s{0,3}(?!Figure\b|Table\b|Algorithm\b)([A-Z][^\n]{0,120})$",
    re.M,
)
_COMMON_HEADING_RE = re.compile(
    r"^(Abstract|Introduction|Conclusions?|References?|Methodology|Results|Discussion(?: and Conclusions)?|Background|Future Work|SUPPLEMENTAL INFORMATION|ACKNOWLEDG[E]?MENTS|DECLARATION OF INTERESTS|Keywords)\b.*$",
    re.I | re.M,
)


def detect_headings_in_text(txt: str) -> List[str]:
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
        if new_start >= len(text):
            break
        start = new_start
    return chunks


