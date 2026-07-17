from typing import Literal

from pydantic import BaseModel, Field


class KnowledgeUploadResponse(BaseModel):
    uploaded_documents: int
    indexed_chunks: int
    collection_name: str


class KnowledgeChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class KnowledgeQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list[KnowledgeChatMessage] = Field(default_factory=list)


class KnowledgeCitation(BaseModel):
    document: str
    page: int | None
    excerpt: str
    score: float | None = None
