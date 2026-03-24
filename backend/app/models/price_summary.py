from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PriceSummary(Base):
    __tablename__ = "price_summary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(Integer, ForeignKey("items.id"), nullable=False)
    world_id: Mapped[int] = mapped_column(Integer, ForeignKey("worlds.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    min_price: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_price: Mapped[int] = mapped_column(Integer, nullable=False)
    max_price: Mapped[int] = mapped_column(Integer, nullable=False)
    volume: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hq: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        Index("ix_price_summary_unique", "item_id", "world_id", "date", "hq", unique=True),
    )
