from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.patient import Patient


class PatientRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, patient_id: int) -> Patient | None:
        stmt = select(Patient).where(Patient.id == patient_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_patients(
        self,
        search: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list[Patient], int]:
        stmt = select(Patient)

        if search:
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Patient.first_name.ilike(term),
                    Patient.last_name.ilike(term),
                    func.concat(Patient.first_name, " ", Patient.last_name).ilike(term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.execute(count_stmt).scalar_one()

        stmt = (
            stmt.order_by(Patient.last_visit.desc().nullslast(), Patient.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        patients = list(self.db.execute(stmt).scalars().all())

        return patients, total

    def count_all(self) -> int:
        stmt = select(func.count()).select_from(Patient)
        return self.db.execute(stmt).scalar_one()

    def count_high_risk(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(Patient).where(
            func.lower(Patient.risk_level) == "high"
        )
        if start_date is not None:
            stmt = stmt.where(Patient.last_visit >= start_date)
        if end_date is not None:
            stmt = stmt.where(Patient.last_visit <= end_date)
        return self.db.execute(stmt).scalar_one()

    def count_by_risk_level(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[tuple[str, int]]:
        stmt = select(
            func.coalesce(Patient.risk_level, "Unknown"),
            func.count(),
        ).group_by(func.coalesce(Patient.risk_level, "Unknown"))
        if start_date is not None:
            stmt = stmt.where(Patient.last_visit >= start_date)
        if end_date is not None:
            stmt = stmt.where(Patient.last_visit <= end_date)
        stmt = stmt.order_by(func.count().desc())
        rows = self.db.execute(stmt).all()
        return [(str(level), int(count)) for level, count in rows]
