from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RankingCache(Base):
    __tablename__ = "ranking_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ranking_type: Mapped[str] = mapped_column(String(50), nullable=False)
    data_json: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
