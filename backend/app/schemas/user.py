from pydantic import BaseModel, ConfigDict

from app.core.roles import UserRole


class UserCreate(BaseModel):
    email: str
    password: str
    role: UserRole = UserRole.VIEWER


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: UserRole
    is_active: bool