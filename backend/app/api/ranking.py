"""ランキングAPI"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.item import Item
from app.models.listing import Listing
from app.models.world import World

router = APIRouter()


@router.get("/expensive")
async def get_expensive_items(
    limit: int = Query(5, le=20),
    db: AsyncSession = Depends(get_db),
):
    """高額アイテムトップN（各アイテムの最安値が高い順）"""
    stmt = (
        select(
            Listing.item_id,
            Item.name_ja,
            Item.name_en,
            Item.icon_url,
            func.min(Listing.price_per_unit).label("min_price"),
            func.count(Listing.id).label("listing_count"),
        )
        .join(Item, Listing.item_id == Item.id)
        .group_by(Listing.item_id, Item.name_ja, Item.name_en, Item.icon_url)
        .order_by(func.min(Listing.price_per_unit).desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [
        {
            "item_id": row.item_id,
            "name_ja": row.name_ja,
            "name_en": row.name_en,
            "icon_url": row.icon_url,
            "min_price": row.min_price,
            "listing_count": row.listing_count,
        }
        for row in result.all()
    ]


@router.get("/arbitrage")
async def get_arbitrage_items(
    limit: int = Query(5, le=20),
    db: AsyncSession = Depends(get_db),
):
    """利益率が高いアイテムトップN（DC間の最安値差が大きい順）"""
    # 各アイテムのDC別最安値を取得し、最安DCと最高DCの差を計算
    result = await db.execute(
        text("""
            SELECT
                a.item_id,
                i.name_ja,
                i.name_en,
                i.icon_url,
                a.min_price AS buy_price,
                a.buy_dc,
                a.buy_world,
                a.max_price AS sell_price,
                a.sell_dc,
                a.sell_world,
                (a.max_price - a.min_price) AS profit,
                ROUND((a.max_price - a.min_price) / a.min_price * 100, 1) AS profit_rate
            FROM (
                SELECT
                    dc_prices.item_id,
                    MIN(dc_prices.dc_min) AS min_price,
                    MAX(dc_prices.dc_min) AS max_price,
                    SUBSTRING_INDEX(
                        GROUP_CONCAT(
                            CONCAT(dc_prices.data_center, ':', dc_prices.world_name)
                            ORDER BY dc_prices.dc_min ASC
                        ), ',', 1
                    ) AS buy_info,
                    SUBSTRING_INDEX(
                        GROUP_CONCAT(
                            CONCAT(dc_prices.data_center, ':', dc_prices.world_name)
                            ORDER BY dc_prices.dc_min DESC
                        ), ',', 1
                    ) AS sell_info
                FROM (
                    SELECT
                        l.item_id,
                        w.data_center,
                        w.name AS world_name,
                        MIN(l.price_per_unit) AS dc_min
                    FROM listings l
                    JOIN worlds w ON l.world_id = w.id
                    GROUP BY l.item_id, w.data_center, w.name
                ) dc_prices
                GROUP BY dc_prices.item_id
                HAVING COUNT(DISTINCT dc_prices.data_center) >= 2
                    AND MIN(dc_prices.dc_min) > 0
                    AND MAX(dc_prices.dc_min) > MIN(dc_prices.dc_min)
            ) a
            JOIN items i ON a.item_id = i.id
            ORDER BY profit_rate DESC
            LIMIT :limit
        """),
        {"limit": limit},
    )

    rows = result.all()
    return [
        {
            "item_id": row.item_id,
            "name_ja": row.name_ja,
            "name_en": row.name_en,
            "icon_url": row.icon_url,
            "buy_price": row.buy_price,
            "buy_info": row.buy_info,
            "sell_price": row.sell_price,
            "sell_info": row.sell_info,
            "profit": row.profit,
            "profit_rate": float(row.profit_rate),
        }
        for row in rows
    ]
