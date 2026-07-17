from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user, get_patient_service
from app.models.user import User
from app.schemas.patient import PatientDetail, PatientListResponse
from app.services.patient_service import PatientNotFoundError, PatientService

router = APIRouter()


@router.get("", response_model=PatientListResponse)
def list_patients(
    search: str | None = Query(default=None, description="Search by patient name"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _: User = Depends(get_current_user),
    patient_service: PatientService = Depends(get_patient_service),
) -> PatientListResponse:
    return patient_service.list_patients(
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/{patient_id}", response_model=PatientDetail)
def get_patient(
    patient_id: int,
    _: User = Depends(get_current_user),
    patient_service: PatientService = Depends(get_patient_service),
) -> PatientDetail:
    try:
        return patient_service.get_patient(patient_id)
    except PatientNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
