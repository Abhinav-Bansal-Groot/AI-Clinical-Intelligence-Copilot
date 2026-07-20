from datetime import date

from sqlalchemy import case, cast, func, select
from sqlalchemy.orm import Session
from sqlalchemy.types import Numeric

from app.models.appointment import Appointment


class AppointmentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_no_show_trend(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[tuple[date, float]]:
        """Return weekly no-show rates for completed + no_show appointments."""
        week_start = func.date_trunc("week", Appointment.appointment_date)

        total = func.count().filter(
            func.lower(Appointment.status).in_(["completed", "no_show"])
        )
        no_shows = func.count().filter(func.lower(Appointment.status) == "no_show")

        rate = case(
            (total == 0, 0),
            else_=cast(no_shows, Numeric) * 100 / cast(total, Numeric),
        )

        stmt = (
            select(week_start, rate)
            .where(func.lower(Appointment.status).in_(["completed", "no_show"]))
            .group_by(week_start)
            .order_by(week_start.asc())
        )
        if start_date is not None:
            stmt = stmt.where(Appointment.appointment_date >= start_date)
        if end_date is not None:
            stmt = stmt.where(Appointment.appointment_date <= end_date)

        rows = self.db.execute(stmt).all()
        result: list[tuple[date, float]] = []
        for week_value, rate_value in rows:
            if week_value is None:
                continue
            week_date = week_value.date() if hasattr(week_value, "date") else week_value
            result.append((week_date, round(float(rate_value or 0), 1)))
        return result

    def count_today(self) -> int:
        today = date.today()
        stmt = (
            select(func.count())
            .select_from(Appointment)
            .where(Appointment.appointment_date == today)
        )
        return int(self.db.execute(stmt).scalar_one())
