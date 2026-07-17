from sqlalchemy.orm import Session

from app.repositories.claim_repository import ClaimRepository
from app.repositories.patient_repository import PatientRepository
from app.schemas.dashboard import DashboardSummary


class DashboardService:
    def __init__(self, db: Session) -> None:
        self.patient_repository = PatientRepository(db)
        self.claim_repository = ClaimRepository(db)

    def get_summary(self) -> DashboardSummary:
        return DashboardSummary(
            total_patients=self.patient_repository.count_all(),
            high_risk_patients=self.patient_repository.count_high_risk(),
            claims_pending=self.claim_repository.count_pending(),
        )
