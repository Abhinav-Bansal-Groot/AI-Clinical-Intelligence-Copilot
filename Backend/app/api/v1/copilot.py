from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_copilot_service, get_current_user
from app.models.user import User
from app.schemas.copilot import CopilotChatRequest
from app.services.copilot_service import CopilotConfigurationError, CopilotService
from app.services.patient_service import PatientNotFoundError

router = APIRouter()


@router.post("/chat/stream")
def copilot_chat_stream(
    payload: CopilotChatRequest,
    _: User = Depends(get_current_user),
    copilot_service: CopilotService = Depends(get_copilot_service),
) -> StreamingResponse:
    try:
        messages = copilot_service.prepare_chat(
            patient_id=payload.patient_id,
            message=payload.message,
        )
    except PatientNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except CopilotConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    return StreamingResponse(
        copilot_service.stream_chat(messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
