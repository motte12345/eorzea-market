"""ランキングAPI（キャッシュテーブルから取得）"""
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ranking_cache import RankingCache

router = APIRouter()


@router.get("/expensive")
async def get_expensive_items(
    limit: int = Query(5, le=20),
    db: AsyncSession = Depends(get_db),
):
    """高額アイテムトップN"""
    result = await db.execute(
        select(RankingCache).where(RankingCache.ranking_type == "expensive")
    )
    cache = result.scalar_one_or_none()
    if not cache:
        return []
    data = json.loads(cache.data_json)
    return data[:limit]


@router.get("/arbitrage")
async def get_arbitrage_items(
    limit: int = Query(5, le=20),
    db: AsyncSession = Depends(get_db),
):
    """利益率が高いアイテムトップN"""
    result = await db.execute(
        select(RankingCache).where(RankingCache.ranking_type == "arbitrage")
    )
    cache = result.scalar_one_or_none()
    if not cache:
        return []
    data = json.loads(cache.data_json)
    return data[:limit]
