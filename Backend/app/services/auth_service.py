from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, TokenResponse


class AuthenticationError(Exception):
    pass


class AuthService:
    def __init__(self, db: Session) -> None:
        self.user_repository = UserRepository(db)

    def login(self, credentials: LoginRequest) -> TokenResponse:
        user = self.user_repository.get_by_email(credentials.email.lower())

        if user is None or not verify_password(credentials.password, user.password_hash):
            raise AuthenticationError("Invalid email or password")

        if not user.is_active:
            raise AuthenticationError("Account is inactive")

        access_token = create_access_token(subject=str(user.id))
        return TokenResponse(access_token=access_token)

    def get_current_user(self, user_id: int) -> User:
        user = self.user_repository.get_by_id(user_id)

        if user is None or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        return user
