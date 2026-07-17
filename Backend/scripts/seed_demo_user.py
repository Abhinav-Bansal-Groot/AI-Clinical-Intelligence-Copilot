"""Seed or update the demo doctor user with a bcrypt password hash."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User

DEMO_EMAIL = "doctor@demo.com"
DEMO_PASSWORD = "Demo@123"
DEMO_FULL_NAME = "Dr. Demo Physician"


def seed_demo_user() -> None:
    db = SessionLocal()
    try:
        existing = db.execute(select(User).where(User.email == DEMO_EMAIL)).scalar_one_or_none()

        if existing:
            existing.password_hash = hash_password(DEMO_PASSWORD)
            existing.full_name = DEMO_FULL_NAME
            existing.role = "doctor"
            existing.is_active = True
            print(f"Updated demo user: {DEMO_EMAIL}")
        else:
            demo_user = User(
                full_name=DEMO_FULL_NAME,
                email=DEMO_EMAIL,
                password_hash=hash_password(DEMO_PASSWORD),
                role="doctor",
                is_active=True,
            )
            db.add(demo_user)
            print(f"Created demo user: {DEMO_EMAIL}")

        db.commit()
        print(f"Password: {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_user()
