from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collector.scheduler import mark_items_requested
from app.database import get_db
from app.models.item import Item
from app.services.universalis_proxy import fetch_item_prices_live, fetch_item_history_live

from app.collector.bulk_fetch import fetch_bulk_listings
from app.config import settings
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

_bg_engine = None
_bg_session_factory = None


def _get_bg_session_factory():
    global _bg_engine, _bg_session_factory
    if _bg_session_factory is None:
        _bg_engine = create_async_engine(settings.database_url)
        _bg_session_factory = async_sessionmaker(_bg_engine, expire_on_commit=False)
    return _bg_session_factory


async def _bg_fetch_and_store(item_id: int):
    """バックグラウンドでUniversalisからデータを取得してDBに保存"""
    session_factory = _get_bg_session_factory()
    try:
        await fetch_bulk_listings(session_factory, [item_id], batch_size=1, save_history=False)
    except Exception:
        pass  # バックグラウンドなので握りつぶす
from app.models.listing import Listing
from app.models.price_summary import PriceSummary
from app.models.sale_history import SaleHistory
from app.models.world import World
from app.schemas.item import ItemResponse, ItemSearchResponse, PriceByWorldResponse

router = APIRouter()


@router.get("/search", response_model=list[ItemSearchResponse])
async def search_items(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """アイテム名で検索"""
    stmt = (
        select(Item)
        .where(Item.name_ja.ilike(f"%{q}%") | Item.name_en.ilike(f"%{q}%"))
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [ItemSearchResponse.model_validate(row) for row in result.scalars().all()]


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int, db: AsyncSession = Depends(get_db)):
    """アイテム詳細"""
    stmt = select(Item).where(Item.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return ItemResponse.model_validate(item)


@router.get("/{item_id}/prices")
async def get_item_prices(
    item_id: int,
    hq: bool | None = None,
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """アイテムの全ワールド価格一覧（DBにあればDB、なければAPIプロキシ）"""
    # DBから取得を試みる
    stmt = (
        select(
            Listing.world_id,
            World.name.label("world_name"),
            World.data_center,
            World.region,
            Listing.price_per_unit,
            Listing.quantity,
            Listing.hq,
            Listing.retainer_name,
            Listing.fetched_at,
            Listing.last_upload_at,
        )
        .join(World, Listing.world_id == World.id)
        .where(Listing.item_id == item_id)
        .order_by(Listing.price_per_unit.asc())
    )
    if hq is not None:
        stmt = stmt.where(Listing.hq == hq)

    result = await db.execute(stmt)
    rows = [dict(row._mapping) for row in result.all()]

    if rows:
        return rows

    # Universalis API から直接取得 + バックグラウンドでDB保存
    listings = await fetch_item_prices_live(item_id)
    background_tasks.add_task(_bg_fetch_and_store, item_id)
    if hq is not None:
        listings = [l for l in listings if l["hq"] == hq]
    return listings


@router.get("/{item_id}/stats")
async def get_item_stats(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """アイテムの価格統計（DC別の最安値、平均、出品数）"""
    stmt = (
        select(
            World.data_center,
            World.region,
            func.min(Listing.price_per_unit).label("min_price"),
            func.avg(Listing.price_per_unit).label("avg_price"),
            func.max(Listing.price_per_unit).label("max_price"),
            func.count(Listing.id).label("listing_count"),
            func.sum(Listing.quantity).label("total_quantity"),
        )
        .join(World, Listing.world_id == World.id)
        .where(Listing.item_id == item_id)
        .group_by(World.data_center, World.region)
        .order_by(func.min(Listing.price_per_unit).asc())
    )
    result = await db.execute(stmt)
    return [
        {
            "data_center": row.data_center,
            "region": row.region,
            "min_price": row.min_price,
            "avg_price": int(row.avg_price) if row.avg_price else 0,
            "max_price": row.max_price,
            "listing_count": row.listing_count,
            "total_quantity": int(row.total_quantity),
        }
        for row in result.all()
    ]


@router.get("/{item_id}/history")
async def get_item_history(
    item_id: int,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """アイテムの売買履歴（DBにあればDB、なければAPIプロキシ）"""
    stmt = (
        select(
            SaleHistory.price_per_unit,
            SaleHistory.quantity,
            SaleHistory.hq,
            SaleHistory.sold_at,
            World.name.label("world_name"),
            World.data_center,
        )
        .join(World, SaleHistory.world_id == World.id)
        .where(SaleHistory.item_id == item_id)
        .order_by(SaleHistory.sold_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = [dict(row._mapping) for row in result.all()]

    if rows:
        return rows

    return await fetch_item_history_live(item_id, limit)


@router.get("/{item_id}/price-history")
async def get_price_history(
    item_id: int,
    days: int = Query(30, le=365),
    db: AsyncSession = Depends(get_db),
):
    """アイテムの日次価格推移"""
    from datetime import date, timedelta

    start_date = date.today() - timedelta(days=days)
    stmt = (
        select(
            PriceSummary.date,
            PriceSummary.min_price,
            PriceSummary.avg_price,
            PriceSummary.max_price,
            PriceSummary.volume,
            PriceSummary.hq,
            World.data_center,
        )
        .join(World, PriceSummary.world_id == World.id)
        .where(PriceSummary.item_id == item_id, PriceSummary.date >= start_date)
        .order_by(PriceSummary.date.asc())
    )
    result = await db.execute(stmt)
    return [dict(row._mapping) for row in result.all()]
