from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_insights_service
from app.models.user import User
from app.schemas.insights import InsightsSummary
from app.services.insights_service import InsightsService

router = APIRouter()


@router.get("/summary", response_model=InsightsSummary)
def get_insights_summary(
    _: User = Depends(get_current_user),
    insights_service: InsightsService = Depends(get_insights_service),
) -> InsightsSummary:
    return insights_service.get_summary()
