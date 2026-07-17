from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.claim import Claim
from app.models.patient import Patient


class DashboardCopilotRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_patients_by_ids(self, patient_ids: list[int]) -> list[Patient]:
        if not patient_ids:
            return []
        stmt = select(Patient).where(Patient.id.in_(patient_ids)).order_by(Patient.id)
        return list(self.db.execute(stmt).scalars().all())

    def get_high_risk_patients(self, limit: int = 15) -> list[Patient]:
        return self.get_patients_by_risk_level("high", limit)

    def get_patients_by_risk_level(
        self,
        risk_level: str,
        limit: int = 20,
    ) -> list[Patient]:
        stmt = (
            select(Patient)
            .where(func.lower(Patient.risk_level) == risk_level.lower())
            .order_by(Patient.last_visit.asc().nullsfirst(), Patient.id)
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_today_high_risk_patients(self) -> list[tuple[Patient, Appointment]]:
        stmt = (
            select(Patient, Appointment)
            .join(Appointment, Appointment.patient_id == Patient.id)
            .where(
                Appointment.appointment_date == date.today(),
                func.lower(Patient.risk_level) == "high",
            )
            .order_by(Patient.id)
        )
        return list(self.db.execute(stmt).all())

    def get_recent_no_shows(
        self,
        days: int = 30,
        limit: int = 20,
    ) -> list[tuple[Patient, Appointment]]:
        cutoff = date.today() - timedelta(days=days)
        stmt = (
            select(Patient, Appointment)
            .join(Patient, Patient.id == Appointment.patient_id)
            .where(
                func.lower(Appointment.status) == "no_show",
                Appointment.appointment_date >= cutoff,
                Appointment.appointment_date <= date.today(),
            )
            .order_by(Appointment.appointment_date.desc(), Patient.id)
            .limit(limit)
        )
        return list(self.db.execute(stmt).all())

    def get_denied_claim_summary(self) -> dict[str, Any]:
        denied_filter = func.lower(Claim.status) == "denied"
        summary_stmt = select(
            func.count(Claim.id),
            func.coalesce(func.sum(Claim.amount), 0),
        ).where(denied_filter)
        count, amount = self.db.execute(summary_stmt).one()

        detail_stmt = (
            select(Claim, Patient)
            .outerjoin(Patient, Patient.id == Claim.patient_id)
            .where(denied_filter)
            .order_by(Claim.claim_date.desc().nullslast(), Claim.id.desc())
            .limit(20)
        )
        return {
            "count": int(count),
            "amount": Decimal(str(amount)),
            "items": list(self.db.execute(detail_stmt).all()),
        }

    def get_patient_appointments(self, patient_ids: list[int]) -> list[Appointment]:
        if not patient_ids:
            return []
        stmt = (
            select(Appointment)
            .where(Appointment.patient_id.in_(patient_ids))
            .order_by(Appointment.appointment_date.desc())
            .limit(30)
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_patient_claims(self, patient_ids: list[int]) -> list[Claim]:
        if not patient_ids:
            return []
        stmt = (
            select(Claim)
            .where(Claim.patient_id.in_(patient_ids))
            .order_by(Claim.claim_date.desc().nullslast(), Claim.id.desc())
            .limit(30)
        )
        return list(self.db.execute(stmt).scalars().all())
