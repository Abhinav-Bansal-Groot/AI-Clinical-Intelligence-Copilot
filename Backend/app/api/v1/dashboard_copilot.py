from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user, get_dashboard_copilot_service
from app.models.user import User
from app.schemas.dashboard_copilot import (
    DashboardCopilotBootstrap,
    DashboardCopilotChatRequest,
)
from app.services.dashboard_copilot_service import (
    DashboardCopilotConfigurationError,
    DashboardCopilotService,
)

router = APIRouter()

SUGGESTED_QUERIES = [
    "Show today's high-risk patients",
    "Which patients missed appointments?",
    "Which patients need more attention?",
    "How many claims are denied?",
]


@router.get("/bootstrap", response_model=DashboardCopilotBootstrap)
def dashboard_copilot_bootstrap(
    current_user: User = Depends(get_current_user),
) -> DashboardCopilotBootstrap:
    return DashboardCopilotBootstrap(
        doctor_name=current_user.full_name,
        suggested_queries=SUGGESTED_QUERIES,
    )


@router.post("/chat/stream")
def dashboard_copilot_chat_stream(
    payload: DashboardCopilotChatRequest,
    current_user: User = Depends(get_current_user),
    service: DashboardCopilotService = Depends(get_dashboard_copilot_service),
) -> StreamingResponse:
    try:
        messages = service.prepare_chat(
            current_user=current_user,
            message=payload.message,
            history=payload.history,
        )
    except DashboardCopilotConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    return StreamingResponse(
        service.stream_chat(messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
