from sqlalchemy.orm import Session

from app.repositories.patient_repository import PatientRepository
from app.schemas.patient import PatientDetail, PatientListItem, PatientListResponse


class PatientNotFoundError(Exception):
    pass


class PatientService:
    def __init__(self, db: Session) -> None:
        self.patient_repository = PatientRepository(db)

    def list_patients(
        self,
        search: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PatientListResponse:
        patients, total = self.patient_repository.list_patients(
            search=search,
            page=page,
            page_size=page_size,
        )
        return PatientListResponse(
            items=[PatientListItem.model_validate(patient) for patient in patients],
            total=total,
            page=page,
            page_size=page_size,
        )

    def get_patient(self, patient_id: int) -> PatientDetail:
        patient = self.patient_repository.get_by_id(patient_id)
        if patient is None:
            raise PatientNotFoundError("Patient not found")
        return PatientDetail.model_validate(patient)
