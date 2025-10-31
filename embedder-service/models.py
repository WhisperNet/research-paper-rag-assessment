from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


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


class EmbedRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = Field(default="BAAI/bge-small-en-v1.5")
    normalize: Optional[bool] = Field(default=True)


class EmbedResponse(BaseModel):
    model: str
    vectors: List[List[float]]
    dim: int


