from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SaleHistory(Base):
    __tablename__ = "sale_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(Integer, ForeignKey("items.id"), nullable=False)
    world_id: Mapped[int] = mapped_column(Integer, ForeignKey("worlds.id"), nullable=False)
    price_per_unit: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    hq: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sold_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    __table_args__ = (
        Index("ix_sale_history_item_world", "item_id", "world_id"),
        Index("ix_sale_history_sold_at", "sold_at"),
        Index("ix_sale_history_unique", "item_id", "world_id", "sold_at", "price_per_unit", "quantity", unique=True),
    )
