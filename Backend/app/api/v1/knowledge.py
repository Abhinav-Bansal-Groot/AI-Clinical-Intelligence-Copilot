from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user, get_knowledge_service
from app.models.user import User
from app.schemas.knowledge import KnowledgeQueryRequest, KnowledgeUploadResponse
from app.services.knowledge_service import (
    KnowledgeConfigurationError,
    KnowledgeDocumentError,
    KnowledgeService,
    UploadedKnowledgeFile,
)

router = APIRouter()


@router.post(
    "/upload",
    response_model=KnowledgeUploadResponse,
    summary="Upload PDF from your device",
)
async def upload_knowledge_documents(
    file: Annotated[
        UploadFile,
        File(description="PDF file from your computer (Choose File)"),
    ],
    _: User = Depends(get_current_user),
    knowledge_service: KnowledgeService = Depends(get_knowledge_service),
) -> KnowledgeUploadResponse:
    try:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise KnowledgeDocumentError("Only PDF uploads are supported")

        content = await file.read()
        uploaded_files = [
            UploadedKnowledgeFile(filename=file.filename, content=content),
        ]
        return knowledge_service.upload_documents(uploaded_files)
    except KnowledgeDocumentError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except KnowledgeConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.post("/query/stream")
def query_knowledge_stream(
    payload: KnowledgeQueryRequest,
    _: User = Depends(get_current_user),
    knowledge_service: KnowledgeService = Depends(get_knowledge_service),
) -> StreamingResponse:
    try:
        messages = knowledge_service.prepare_query(
            question=payload.question,
            history=payload.history,
        )
    except KnowledgeConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    return StreamingResponse(
        knowledge_service.stream_query(messages=messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
