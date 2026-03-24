from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(Integer, ForeignKey("items.id"), nullable=False)
    world_id: Mapped[int] = mapped_column(Integer, ForeignKey("worlds.id"), nullable=False)
    price_per_unit: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    total: Mapped[int] = mapped_column(BigInteger, nullable=False)
    hq: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    retainer_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_upload_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_listings_item_world", "item_id", "world_id"),
        Index("ix_listings_fetched_at", "fetched_at"),
    )
