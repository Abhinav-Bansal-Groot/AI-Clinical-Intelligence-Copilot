from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.services.auth_service import AuthService, AuthenticationError
from app.services.copilot_service import CopilotService
from app.services.dashboard_copilot_service import DashboardCopilotService
from app.services.dashboard_service import DashboardService
from app.services.insights_service import InsightsService
from app.services.knowledge_service import KnowledgeService
from app.services.patient_service import PatientService

security_scheme = HTTPBearer()


def get_auth_service(db: Session = Depends(get_db)) -> Generator[AuthService, None, None]:
    yield AuthService(db)


def get_patient_service(db: Session = Depends(get_db)) -> Generator[PatientService, None, None]:
    yield PatientService(db)


def get_dashboard_service(db: Session = Depends(get_db)) -> Generator[DashboardService, None, None]:
    yield DashboardService(db)


def get_copilot_service(db: Session = Depends(get_db)) -> Generator[CopilotService, None, None]:
    yield CopilotService(db)


def get_dashboard_copilot_service(
    db: Session = Depends(get_db),
) -> Generator[DashboardCopilotService, None, None]:
    yield DashboardCopilotService(db)


def get_knowledge_service() -> Generator[KnowledgeService, None, None]:
    yield KnowledgeService()


def get_insights_service(db: Session = Depends(get_db)) -> Generator[InsightsService, None, None]:
    yield InsightsService(db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return auth_service.get_current_user(int(user_id))
    except (AuthenticationError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
