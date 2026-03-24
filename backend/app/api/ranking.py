"""ランキングAPI（キャッシュテーブルから取得）"""
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
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
