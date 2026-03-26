from typing import Optional

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    name_ja: Mapped[str] = mapped_column(Text, nullable=False, default="")
    name_en: Mapped[str] = mapped_column(Text, nullable=False, default="")
    icon_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    category_en: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    lodestone_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
