from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_patients: int
    high_risk_patients: int
    claims_pending: int
