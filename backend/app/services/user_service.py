from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, normalize_email


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    # Case-insensitive, so "Admin@Nexora.demo" finds admin@nexora.demo (and sign-up can't
    # create a second account that differs only in case).
    return (
        db.query(User)
        .filter(func.lower(User.email) == normalize_email(email))
        .first()
    )


def create_user(
    db: Session,
    user_data: UserCreate,
) -> User:
    hashed_password = hash_password(user_data.password)

    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        role=user_data.role,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user