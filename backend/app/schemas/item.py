from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ItemSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_ja: str
    name_en: str
    icon_url: str
    category: str


class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_ja: str
    name_en: str
    icon_url: str
    category: str


class PriceByWorldResponse(BaseModel):
    world_id: int
    world_name: str
    data_center: str
    region: str
    price_per_unit: int
    quantity: int
    hq: bool
    retainer_name: str
    fetched_at: datetime
    last_upload_at: Optional[datetime] = None
