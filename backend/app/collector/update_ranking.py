"""ランキングキャッシュを更新"""
import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.item import Item  # noqa: F401
from app.models.listing import Listing  # noqa: F401
from app.models.ranking_cache import RankingCache
from app.models.world import World  # noqa: F401

logger = logging.getLogger(__name__)

# 集計対象リージョン（中国・韓国を除外）
INCLUDED_REGIONS = ("Japan", "North-America", "Europe", "Oceania")

# ランキングから除外するアイテムID
EXCLUDED_ITEM_IDS: list[int] = [
    5859, 39494, 33687, 39493, 33688,
]


async def update_rankings(session_factory: async_sessionmaker) -> None:
    """ランキングを計算してキャッシュに保存"""
    regions_sql = ", ".join(f"'{r}'" for r in INCLUDED_REGIONS)
    excluded_sql = ", ".join(str(i) for i in EXCLUDED_ITEM_IDS) if EXCLUDED_ITEM_IDS else "0"

    async with session_factory() as session:
        # 高額アイテム TOP10
        logger.info("Calculating expensive items...")
        expensive_result = await session.execute(
            text(f"""
                SELECT
                    item_id, name_ja, name_en, icon_url,
                    global_min AS min_price, listing_count
                FROM (
                    SELECT
                        l.item_id,
                        i.name_ja, i.name_en, i.icon_url,
                        MIN(l.price_per_unit) AS global_min,
                        COUNT(l.id) AS listing_count
                    FROM listings l
                    JOIN items i ON l.item_id = i.id
                    JOIN worlds w ON l.world_id = w.id
                    WHERE w.region IN ({regions_sql})
                        AND l.item_id NOT IN ({excluded_sql})
                    GROUP BY l.item_id, i.name_ja, i.name_en, i.icon_url
                ) ranked
                WHERE global_min > 0
                    AND global_min < 300000000
                    AND listing_count > 5
                ORDER BY global_min DESC
                LIMIT 20
            """)
        )
        expensive = [
            {
                "item_id": r.item_id,
                "name_ja": r.name_ja,
                "name_en": r.name_en,
                "icon_url": r.icon_url,
                "min_price": r.min_price,
                "listing_count": r.listing_count,
            }
            for r in expensive_result.all()
        ]

        # 利益率ランキング TOP10
        logger.info("Calculating arbitrage items...")
        arb_result = await session.execute(
            text(f"""
                SELECT
                    a.item_id,
                    i.name_ja, i.name_en, i.icon_url,
                    a.min_price AS buy_price,
                    a.buy_dc AS buy_info,
                    a.max_price AS sell_price,
                    a.sell_dc AS sell_info,
                    (a.max_price - a.min_price) AS profit,
                    ROUND((a.max_price - a.min_price) / a.min_price * 100, 1) AS profit_rate
                FROM (
                    SELECT
                        dc_prices.item_id,
                        MIN(dc_prices.dc_min) AS min_price,
                        MAX(dc_prices.dc_min) AS max_price,
                        SUBSTRING_INDEX(
                            GROUP_CONCAT(dc_prices.data_center ORDER BY dc_prices.dc_min ASC), ',', 1
                        ) AS buy_dc,
                        SUBSTRING_INDEX(
                            GROUP_CONCAT(dc_prices.data_center ORDER BY dc_prices.dc_min DESC), ',', 1
                        ) AS sell_dc
                    FROM (
                        SELECT
                            l.item_id,
                            w.data_center,
                            MIN(l.price_per_unit) AS dc_min
                        FROM listings l
                        JOIN worlds w ON l.world_id = w.id
                        WHERE w.region IN ({regions_sql})
                        GROUP BY l.item_id, w.data_center
                    ) dc_prices
                    GROUP BY dc_prices.item_id
                    HAVING COUNT(DISTINCT dc_prices.data_center) >= 2
                        AND MIN(dc_prices.dc_min) >= 10000
                        AND MAX(dc_prices.dc_min) < 300000000
                        AND MAX(dc_prices.dc_min) > MIN(dc_prices.dc_min)
                        AND (MAX(dc_prices.dc_min) - MIN(dc_prices.dc_min)) <= 50000000
                ) a
                JOIN items i ON a.item_id = i.id
                WHERE a.item_id NOT IN ({excluded_sql})
                    AND ROUND((a.max_price - a.min_price) / a.min_price * 100, 1) <= 1000
                ORDER BY profit_rate DESC
                LIMIT 20
            """)
        )
        arbitrage = [
            {
                "item_id": r.item_id,
                "name_ja": r.name_ja,
                "name_en": r.name_en,
                "icon_url": r.icon_url,
                "buy_price": r.buy_price,
                "buy_info": r.buy_info,
                "sell_price": r.sell_price,
                "sell_info": r.sell_info,
                "profit": r.profit,
                "profit_rate": float(r.profit_rate),
            }
            for r in arb_result.all()
        ]

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # キャッシュに保存（UPSERT）
        for ranking_type, data in [("expensive", expensive), ("arbitrage", arbitrage)]:
            existing = await session.execute(
                select(RankingCache).where(RankingCache.ranking_type == ranking_type)
            )
            cache = existing.scalar_one_or_none()
            if cache:
                cache.data_json = json.dumps(data, ensure_ascii=False)
                cache.updated_at = now
            else:
                session.add(RankingCache(
                    ranking_type=ranking_type,
                    data_json=json.dumps(data, ensure_ascii=False),
                    updated_at=now,
                ))
            await session.commit()

        logger.info(f"Rankings updated: {len(expensive)} expensive, {len(arbitrage)} arbitrage")


async def main():
    logging.basicConfig(level=logging.INFO)
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    await update_rankings(session_factory)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
