import json
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from uuid import uuid4

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pypdf import PdfReader
from qdrant_client import QdrantClient, models

from app.core.config import get_settings
from app.schemas.knowledge import KnowledgeChatMessage, KnowledgeCitation, KnowledgeUploadResponse


class KnowledgeConfigurationError(Exception):
    pass


class KnowledgeDocumentError(Exception):
    pass


@dataclass(frozen=True)
class UploadedKnowledgeFile:
    filename: str
    content: bytes


class KnowledgeService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._validate_configuration()
        self.client = QdrantClient(
            url=self.settings.qdrant_url,
            api_key=self.settings.qdrant_api_key or None,
        )
        self.embeddings = OpenAIEmbeddings(
            api_key=self.settings.openai_api_key,
            model=self.settings.openai_embedding_model,
        )

    def upload_documents(
        self,
        files: Sequence[UploadedKnowledgeFile],
    ) -> KnowledgeUploadResponse:
        self._ensure_collection()

        indexed_chunks = 0
        uploaded_documents = 0

        for file in files:
            if not file.filename.lower().endswith(".pdf"):
                raise KnowledgeDocumentError("Only PDF uploads are supported")

            page_chunks = self._extract_pdf_chunks(file)
            if not page_chunks:
                continue

            texts = [chunk["text"] for chunk in page_chunks]
            vectors = self.embeddings.embed_documents(texts)
            points = [
                models.PointStruct(
                    id=str(uuid4()),
                    vector=vector,
                    payload={
                        "document": file.filename,
                        "page": chunk["page"],
                        "text": chunk["text"],
                    },
                )
                for chunk, vector in zip(page_chunks, vectors, strict=True)
            ]

            self.client.upsert(
                collection_name=self.settings.qdrant_collection_name,
                points=points,
            )
            indexed_chunks += len(points)
            uploaded_documents += 1

        return KnowledgeUploadResponse(
            uploaded_documents=uploaded_documents,
            indexed_chunks=indexed_chunks,
        )

    def prepare_query(
        self,
        question: str,
        history: list[KnowledgeChatMessage] | None = None,
    ) -> list[BaseMessage]:
        history = history or []
        retrieval_query = self._build_retrieval_query(question, history)
        citations = self._retrieve_citations(retrieval_query)
        context = self._build_context(citations)
        has_uploaded_context = bool(citations)

        system_prompt = """
            You are a Clinical Knowledge Assistant for licensed physicians.

            Scope (strict):
            - Answer ONLY questions related to medicine, clinical care, guidelines,
              diagnostics, treatments, medications, hospital SOPs, public health,
              or closely related healthcare topics.
            - If the user asks something off-topic (geography, sports, politics,
              general trivia, coding, etc.), politely refuse and redirect them to
              ask a clinical or healthcare-related question.
            - Brief greetings like "hi" or "hello" may get a short professional welcome,
              then invite a clinical question.

            Conversation:
            - Use the prior conversation turns to resolve pronouns and follow-ups
              (e.g. "how to avoid it" after discussing diabetes means how to avoid diabetes).
            - Stay coherent and conversational across turns.
            - Do not ask for clarification when the referent is clear from recent context.

            Answer priority:
            1. Prefer uploaded document excerpts below when they are relevant.
            2. If excerpts are missing or incomplete, use well-established clinical
               knowledge from major guidelines (ADA, AHA/ACC, WHO, NICE) and
               standard hospital practice.
            3. For in-scope clinical questions, always give a substantive answer.
               Do not say documents lack sufficient information.

            Style:
            - Be concise, professional, and evidence-based.
            - Use headings and bullet points when helpful.
            - Do not mention embeddings, vector databases, retrieval, prompts, or tooling.
        """

        context_section = (
            f"Uploaded document excerpts (use when relevant):\n{context}"
            if has_uploaded_context
            else (
                "Uploaded document excerpts: none retrieved for this question. "
                "Answer using established clinical knowledge when the question is in scope."
            )
        )

        messages: list[BaseMessage] = [
            SystemMessage(content=f"{system_prompt.strip()}\n\n{context_section}"),
        ]
        messages.extend(self._history_to_messages(history))
        messages.append(HumanMessage(content=question.strip()))
        return messages

    @staticmethod
    def _build_retrieval_query(
        question: str,
        history: list[KnowledgeChatMessage],
    ) -> str:
        """Enrich short follow-ups with recent topic context for better retrieval."""
        question = question.strip()
        if len(question.split()) >= 8 or not history:
            return question

        recent = [
            f"{item.role}: {item.content[:280]}"
            for item in history[-4:]
            if item.content.strip()
        ]
        if not recent:
            return question
        return "Conversation context:\n" + "\n".join(recent) + f"\nCurrent question: {question}"

    @staticmethod
    def _history_to_messages(history: list[KnowledgeChatMessage]) -> list[BaseMessage]:
        # Keep the last several turns to limit token usage for the PoC demo.
        recent = history[-10:]
        messages: list[BaseMessage] = []
        for item in recent:
            content = item.content.strip()
            if not content:
                continue
            if item.role == "assistant":
                messages.append(AIMessage(content=content))
            else:
                messages.append(HumanMessage(content=content))
        return messages

    def _retrieve_citations(self, question: str) -> list[KnowledgeCitation]:
        try:
            self._ensure_collection()
            query_vector = self.embeddings.embed_query(question)
            points = self._search(
                query_vector=query_vector,
                top_k=self.settings.qdrant_top_k,
            )
            return [self._point_to_citation(point) for point in points]
        except Exception:
            return []

    def stream_query(
        self,
        messages: list[BaseMessage],
    ) -> Iterator[str]:
        llm = ChatOpenAI(
            api_key=self.settings.openai_api_key,
            model=self.settings.openai_model,
            temperature=0.3,
            streaming=True,
        )

        for chunk in llm.stream(messages):
            token = self._extract_chunk_content(chunk.content)
            if token:
                yield f"data: {json.dumps({'token': token})}\n\n"

        yield "data: [DONE]\n\n"

    def _validate_configuration(self) -> None:
        if not self.settings.openai_api_key:
            raise KnowledgeConfigurationError("OpenAI API key is not configured")
        if not self.settings.qdrant_url:
            raise KnowledgeConfigurationError("Qdrant URL is not configured")

    def _ensure_collection(self) -> None:
        collection_names = {
            collection.name for collection in self.client.get_collections().collections
        }
        if self.settings.qdrant_collection_name in collection_names:
            return

        self.client.create_collection(
            collection_name=self.settings.qdrant_collection_name,
            vectors_config=models.VectorParams(
                size=self.settings.qdrant_vector_size,
                distance=models.Distance.COSINE,
            ),
        )

    def _extract_pdf_chunks(self, file: UploadedKnowledgeFile) -> list[dict[str, Any]]:
        reader = PdfReader(BytesIO(file.content))
        chunks: list[dict[str, Any]] = []

        for page_index, page in enumerate(reader.pages, start=1):
            text = " ".join((page.extract_text() or "").split())
            if not text:
                continue

            for chunk in self._split_text(text):
                chunks.append({"page": page_index, "text": chunk})

        return chunks

    @staticmethod
    def _split_text(text: str, chunk_size: int = 1200, overlap: int = 150) -> list[str]:
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunks.append(text[start:end])
            if end == len(text):
                break
            start = max(end - overlap, 0)

        return chunks

    def _search(self, query_vector: list[float], top_k: int) -> list[Any]:
        if hasattr(self.client, "query_points"):
            result = self.client.query_points(
                collection_name=self.settings.qdrant_collection_name,
                query=query_vector,
                limit=top_k,
                with_payload=True,
            )
            return list(result.points)

        return list(
            self.client.search(
                collection_name=self.settings.qdrant_collection_name,
                query_vector=query_vector,
                limit=top_k,
                with_payload=True,
            )
        )

    @staticmethod
    def _point_to_citation(point: Any) -> KnowledgeCitation:
        payload = point.payload or {}
        text = str(payload.get("text") or "")
        return KnowledgeCitation(
            document=str(payload.get("document") or "Unknown document"),
            page=payload.get("page"),
            excerpt=text[:500],
            score=getattr(point, "score", None),
        )

    @staticmethod
    def _build_context(citations: list[KnowledgeCitation]) -> str:
        if not citations:
            return "No relevant uploaded document context was found."

        return "\n\n".join(
            (
                f"[{index}] Document: {citation.document}\n"
                f"Page: {citation.page or 'Unknown'}\n"
                f"Excerpt: {citation.excerpt}"
            )
            for index, citation in enumerate(citations, start=1)
        )

    @staticmethod
    def _extract_chunk_content(content: str | list) -> str:
        if not content:
            return ""

        if isinstance(content, list):
            text_parts = [part.get("text", "") for part in content if isinstance(part, dict)]
            return "".join(part for part in text_parts if part)

        return str(content)

