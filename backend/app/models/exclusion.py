from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExcludedItem(Base):
    """ランキングから正式に除外されたアイテム"""

    __tablename__ = "excluded_items"

    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id"), primary_key=True, autoincrement=False
    )
    excluded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class ExclusionRequest(Base):
    """ユーザーから受け付けた除外申請（管理者承認待ち）"""

    __tablename__ = "exclusion_requests"

    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id"), primary_key=True, autoincrement=False
    )
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    first_requested_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_requested_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
