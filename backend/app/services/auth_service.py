from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.user import User
from app.services.user_service import get_user_by_email


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User | None:
    user = get_user_by_email(db, email)

    if user is None:
        return None

    if not user.is_active:
        return None

    if not verify_password(
        password,
        user.hashed_password,
    ):
        return None

    return user