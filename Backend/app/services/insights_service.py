from decimal import Decimal

from sqlalchemy.orm import Session

from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.claim_repository import ClaimRepository
from app.repositories.patient_repository import PatientRepository
from app.schemas.insights import (
    AiInsight,
    ClaimDenialsSummary,
    HighRiskPatientsSummary,
    InsightsSummary,
    NoShowTrendPoint,
    RevenueTrendPoint,
    RiskLevelCount,
)

STATIC_RECOMMENDATION = "Recommend reminder campaign."


class InsightsService:
    def __init__(self, db: Session) -> None:
        self.claim_repository = ClaimRepository(db)
        self.patient_repository = PatientRepository(db)
        self.appointment_repository = AppointmentRepository(db)

    def get_summary(self) -> InsightsSummary:
        revenue_rows = self.claim_repository.get_revenue_trend()
        status_counts = self.claim_repository.count_by_status()
        risk_rows = self.patient_repository.count_by_risk_level()
        no_show_rows = self.appointment_repository.get_no_show_trend()

        no_show_trend = [
            NoShowTrendPoint(week=f"W{index}", week_start=week_start, rate=rate)
            for index, (week_start, rate) in enumerate(no_show_rows, start=1)
        ]

        return InsightsSummary(
            revenue_trend=[
                RevenueTrendPoint(date=claim_date, amount=amount)
                for claim_date, amount in revenue_rows
            ],
            no_show_trend=no_show_trend,
            claim_denials=ClaimDenialsSummary(
                approved=status_counts.get("approved", 0),
                pending=status_counts.get("pending", 0),
                denied=status_counts.get("denied", 0),
            ),
            high_risk_patients=HighRiskPatientsSummary(
                total=self.patient_repository.count_high_risk(),
                by_level=[
                    RiskLevelCount(risk_level=level, count=count)
                    for level, count in risk_rows
                ],
            ),
            ai_insight=AiInsight(
                claims_change_percent=self._compute_claims_change_percent(),
                no_shows_change_percent=self._compute_no_shows_change_percent(
                    [point.rate for point in no_show_trend]
                ),
                recommendation=STATIC_RECOMMENDATION,
            ),
        )

    def _compute_claims_change_percent(self) -> float:
        amounts = self.claim_repository.get_claim_amounts_ordered()
        if len(amounts) < 2:
            return 0.0

        midpoint = len(amounts) // 2
        first_half = sum(amounts[:midpoint], Decimal("0"))
        second_half = sum(amounts[midpoint:], Decimal("0"))

        if first_half == 0:
            return 100.0 if second_half > 0 else 0.0

        change = ((second_half - first_half) / first_half) * Decimal("100")
        return round(float(change), 1)

    @staticmethod
    def _compute_no_shows_change_percent(rates: list[float]) -> float:
        if len(rates) < 2:
            return 0.0

        first = rates[0]
        last = rates[-1]
        if first == 0:
            return 100.0 if last > 0 else 0.0

        return round(((last - first) / first) * 100, 1)
