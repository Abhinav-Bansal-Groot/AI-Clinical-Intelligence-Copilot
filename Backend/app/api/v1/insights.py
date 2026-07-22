from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_insights_service
from app.models.user import User
from app.schemas.insights import (
    ClaimDenialsSummary,
    HighRiskPatientsSummary,
    InsightsSummary,
    NoShowTrendPoint,
    RevenueTrendPoint,
)
from app.services.insights_service import InsightsService

router = APIRouter()


@router.get("/revenue-trend", response_model=list[RevenueTrendPoint])
def get_revenue_trend(
    _: User = Depends(get_current_user),
    insights_service: InsightsService = Depends(get_insights_service),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> list[RevenueTrendPoint]:
    return insights_service.get_revenue_trend(start_date=start_date, end_date=end_date)


@router.get("/no-show-trend", response_model=list[NoShowTrendPoint])
def get_no_show_trend(
    _: User = Depends(get_current_user),
    insights_service: InsightsService = Depends(get_insights_service),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> list[NoShowTrendPoint]:
    return insights_service.get_no_show_trend(start_date=start_date, end_date=end_date)


@router.get("/claim-denials", response_model=ClaimDenialsSummary)
def get_claim_denials(
    _: User = Depends(get_current_user),
    insights_service: InsightsService = Depends(get_insights_service),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> ClaimDenialsSummary:
    return insights_service.get_claim_denials(start_date=start_date, end_date=end_date)


@router.get("/high-risk-patients", response_model=HighRiskPatientsSummary)
def get_high_risk_patients(
    _: User = Depends(get_current_user),
    insights_service: InsightsService = Depends(get_insights_service),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> HighRiskPatientsSummary:
    return insights_service.get_high_risk_patients(start_date=start_date, end_date=end_date)


@router.get("/summary", response_model=InsightsSummary)
def get_insights_summary(
    _: User = Depends(get_current_user),
    insights_service: InsightsService = Depends(get_insights_service),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
) -> InsightsSummary:
    return insights_service.get_summary(start_date=start_date, end_date=end_date)
