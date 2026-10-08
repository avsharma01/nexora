"""DEMO ONLY - never run on a deployed server.

Creates three demo accounts with simple, publicly known passwords so the app can be shown
role by role (the login page has "Admin / Analyst / Viewer" buttons that fill these in).
Public sign-up only ever creates Viewers, so this is the local way to get an Admin and an Analyst.

    admin@nexora.demo    admin    nexora-demo-admin
    analyst@nexora.demo  analyst  nexora-demo-analyst
    viewer@nexora.demo   viewer   nexora-demo-viewer

Uses the backend's own create_user() (same password hashing as /auth/register).
Idempotent: an existing account is left exactly as it is.

Run from backend/:
    python -m scripts.seed_demo_users
"""

from sqlalchemy.orm import Session

import app.models  # noqa: F401  (registers every model before the session is used)
from app.core.roles import UserRole
from app.database import engine
from app.schemas.user import UserCreate
from app.services.user_service import create_user, get_user_by_email

DEMO_USERS = [
    ("admin@nexora.demo", "nexora-demo-admin", UserRole.ADMIN),
    ("analyst@nexora.demo", "nexora-demo-analyst", UserRole.ANALYST),
    ("viewer@nexora.demo", "nexora-demo-viewer", UserRole.VIEWER),
]


def seed_demo_users(db: Session) -> None:
    for email, password, role in DEMO_USERS:
        existing = get_user_by_email(db, email)
        if existing is not None:
            print(f"keep   {email} (already exists, role {existing.role.value})")
            continue
        user = create_user(db, UserCreate(email=email, password=password, role=role))
        print(f"create {email} (id {user.id}, role {user.role.value})")


def main() -> None:
    print("DEMO ONLY - these accounts have publicly known passwords. Never run this on a deployed server.")
    with Session(engine) as db:
        seed_demo_users(db)


if __name__ == "__main__":
    main()
