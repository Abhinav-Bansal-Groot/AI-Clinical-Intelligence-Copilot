from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_auth_service, get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, MessageResponse, TokenResponse
from app.services.auth_service import AuthService, AuthenticationError

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(
    credentials: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    try:
        return auth_service.login(credentials)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.get("/me", response_model=MessageResponse)
def get_me(_: User = Depends(get_current_user)) -> MessageResponse:
    return MessageResponse(message="Login successful")
