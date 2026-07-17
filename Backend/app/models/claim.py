from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("patients.id"))
    amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    status: Mapped[str | None] = mapped_column(String(20))
    claim_date: Mapped[date | None] = mapped_column(Date)
