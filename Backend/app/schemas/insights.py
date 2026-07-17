from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class RevenueTrendPoint(BaseModel):
    date: date
    amount: Decimal


class NoShowTrendPoint(BaseModel):
    week: str
    week_start: date
    rate: float


class ClaimDenialsSummary(BaseModel):
    approved: int
    pending: int
    denied: int


class RiskLevelCount(BaseModel):
    risk_level: str
    count: int


class HighRiskPatientsSummary(BaseModel):
    total: int
    by_level: list[RiskLevelCount]


class AiInsight(BaseModel):
    claims_change_percent: float
    no_shows_change_percent: float
    recommendation: str


class InsightsSummary(BaseModel):
    revenue_trend: list[RevenueTrendPoint]
    no_show_trend: list[NoShowTrendPoint]
    claim_denials: ClaimDenialsSummary
    high_risk_patients: HighRiskPatientsSummary
    ai_insight: AiInsight
