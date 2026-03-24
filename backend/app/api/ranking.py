"""ランキングAPI（キャッシュテーブルから取得）"""
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ranking_cache import RankingCache

from app.models.item import Item
from app.collector.update_ranking import EXCLUDED_ITEM_IDS

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
    if not EXCLUDED_ITEM_IDS:
        return {"ids": [], "items": [], "note": "アイテム名に「SP」を含むものも除外"}

    result = await db.execute(
        select(Item).where(Item.id.in_(EXCLUDED_ITEM_IDS))
    )
    items = [
        {"id": i.id, "name_ja": i.name_ja, "name_en": i.name_en, "icon_url": i.icon_url}
        for i in result.scalars().all()
    ]
    return {
        "ids": EXCLUDED_ITEM_IDS,
        "items": items,
        "note": "上記アイテムおよびアイテム名に「SP」を含むものはランキングから除外",
    }
