import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.roles import UserRole

# Deliberately simple (no email-validator dependency): one "@", a dot in the domain, no spaces.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value: str) -> str:
    """Emails are stored and compared trimmed and lower-cased."""
    return value.strip().lower()


class UserCreate(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.VIEWER

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = normalize_email(value)
        if not _EMAIL_RE.match(value):
            raise ValueError("Enter a valid email address")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: UserRole
    is_active: bool