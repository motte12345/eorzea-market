"""除外申請API"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.exclusion import ExcludedItem, ExclusionRequest
from app.models.item import Item

router = APIRouter()


@router.post("/{item_id}")
async def request_exclusion(item_id: int, db: AsyncSession = Depends(get_db)):
    """アイテムをランキング除外候補として申請する。重複は count を増やす。"""
    item_exists = await db.execute(select(Item.id).where(Item.id == item_id))
    if item_exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="item not found")

    already_excluded = await db.execute(
        select(ExcludedItem.item_id).where(ExcludedItem.item_id == item_id)
    )
    if already_excluded.scalar_one_or_none() is not None:
        return {"status": "already_excluded", "item_id": item_id}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    existing = await db.execute(
        select(ExclusionRequest).where(ExclusionRequest.item_id == item_id)
    )
    req = existing.scalar_one_or_none()
    if req is None:
        db.add(
            ExclusionRequest(
                item_id=item_id,
                request_count=1,
                first_requested_at=now,
                last_requested_at=now,
            )
        )
        count = 1
    else:
        req.request_count += 1
        req.last_requested_at = now
        count = req.request_count

    await db.commit()
    return {"status": "requested", "item_id": item_id, "request_count": count}


@router.get("")
async def list_exclusion_requests(db: AsyncSession = Depends(get_db)):
    """申請キュー一覧（管理用）"""
    result = await db.execute(
        select(
            ExclusionRequest.item_id,
            ExclusionRequest.request_count,
            ExclusionRequest.first_requested_at,
            ExclusionRequest.last_requested_at,
            Item.name_ja,
            Item.name_en,
            Item.icon_url,
        )
        .join(Item, Item.id == ExclusionRequest.item_id)
        .order_by(ExclusionRequest.request_count.desc(), ExclusionRequest.last_requested_at.desc())
    )
    return [
        {
            "item_id": row.item_id,
            "name_ja": row.name_ja,
            "name_en": row.name_en,
            "icon_url": row.icon_url,
            "request_count": row.request_count,
            "first_requested_at": row.first_requested_at.isoformat(),
            "last_requested_at": row.last_requested_at.isoformat(),
        }
        for row in result.all()
    ]
