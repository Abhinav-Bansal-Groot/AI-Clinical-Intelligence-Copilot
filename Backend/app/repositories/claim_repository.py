from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.claim import Claim


class ClaimRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def count_pending(self) -> int:
        stmt = select(func.count()).select_from(Claim).where(
            func.lower(Claim.status) == "pending"
        )
        return self.db.execute(stmt).scalar_one()

    def get_revenue_trend(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[tuple[date, Decimal]]:
        stmt = (
            select(Claim.claim_date, func.coalesce(func.sum(Claim.amount), 0))
            .where(Claim.claim_date.is_not(None))
            .group_by(Claim.claim_date)
            .order_by(Claim.claim_date.asc())
        )
        if start_date is not None:
            stmt = stmt.where(Claim.claim_date >= start_date)
        if end_date is not None:
            stmt = stmt.where(Claim.claim_date <= end_date)
        rows = self.db.execute(stmt).all()
        return [(row[0], Decimal(str(row[1]))) for row in rows]

    def count_by_status(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, int]:
        stmt = (
            select(func.lower(Claim.status), func.count())
            .where(Claim.status.is_not(None))
            .group_by(func.lower(Claim.status))
        )
        if start_date is not None:
            stmt = stmt.where(Claim.claim_date >= start_date)
        if end_date is not None:
            stmt = stmt.where(Claim.claim_date <= end_date)
        rows = self.db.execute(stmt).all()
        return {str(status): int(count) for status, count in rows}

    def get_claim_amounts_ordered(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[Decimal]:
        stmt = (
            select(Claim.amount)
            .where(Claim.claim_date.is_not(None), Claim.amount.is_not(None))
            .order_by(Claim.claim_date.asc(), Claim.id.asc())
        )
        if start_date is not None:
            stmt = stmt.where(Claim.claim_date >= start_date)
        if end_date is not None:
            stmt = stmt.where(Claim.claim_date <= end_date)
        rows = self.db.execute(stmt).scalars().all()
        return [Decimal(str(amount)) for amount in rows]
