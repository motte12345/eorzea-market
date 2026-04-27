"""ランキングAPI（キャッシュテーブルから取得）"""
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.exclusion import ExcludedItem
from app.models.item import Item
from app.models.ranking_cache import RankingCache

router = APIRouter()


async def _get_cached(db: AsyncSession, ranking_type: str, limit: int) -> list:
    result = await db.execute(
        select(RankingCache).where(RankingCache.ranking_type == ranking_type)
    )
    cache = result.scalar_one_or_none()
    if not cache:
        return []
    return json.loads(cache.data_json)[:limit]


@router.get("/expensive")
async def get_expensive_items(
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    return await _get_cached(db, "expensive", limit)


@router.get("/arbitrage")
async def get_arbitrage_items(
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    return await _get_cached(db, "arbitrage", limit)


@router.get("/arbitrage-profit")
async def get_arbitrage_profit_items(
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    return await _get_cached(db, "arbitrage_profit", limit)


@router.get("/excluded")
async def get_excluded_items(db: AsyncSession = Depends(get_db)):
    """ランキングから除外されたアイテム一覧"""
    result = await db.execute(
        select(Item, ExcludedItem.excluded_at, ExcludedItem.reason)
        .join(ExcludedItem, Item.id == ExcludedItem.item_id)
        .order_by(ExcludedItem.excluded_at.desc())
    )
    items = []
    ids: list[int] = []
    for item, excluded_at, reason in result.all():
        ids.append(item.id)
        items.append(
            {
                "id": item.id,
                "name_ja": item.name_ja,
                "name_en": item.name_en,
                "icon_url": item.icon_url,
                "excluded_at": excluded_at.isoformat() if excluded_at else None,
                "reason": reason,
            }
        )
    return {
        "ids": ids,
        "items": items,
        "note": "上記アイテムおよびアイテム名に「SP」を含むものはランキングから除外",
    }
