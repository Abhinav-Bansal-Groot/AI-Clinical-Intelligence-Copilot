from datetime import date

from pydantic import BaseModel


class PatientListItem(BaseModel):
    id: int
    first_name: str | None
    last_name: str | None
    age: int | None
    gender: str | None
    risk_level: str | None
    last_visit: date | None
    conditions: str | None

    model_config = {"from_attributes": True}


class PatientDetail(BaseModel):
    id: int
    first_name: str | None
    last_name: str | None
    age: int | None
    gender: str | None
    conditions: str | None
    medications: str | None
    allergies: str | None
    last_visit: date | None
    recent_labs: str | None
    risk_level: str | None
    notes: str | None

    model_config = {"from_attributes": True}


class PatientListResponse(BaseModel):
    items: list[PatientListItem]
    total: int
    page: int
    page_size: int
