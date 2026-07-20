from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_insights_service
from app.models.user import User
from app.schemas.insights import InsightsSummary
from app.services.insights_service import InsightsService

router = APIRouter()


@router.get("/summary", response_model=InsightsSummary)
def get_insights_summary(
    _: User = Depends(get_current_user),
    insights_service: InsightsService = Depends(get_insights_service),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> InsightsSummary:
    return insights_service.get_summary(start_date=start_date, end_date=end_date)
