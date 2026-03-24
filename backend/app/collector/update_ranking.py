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
    5852, 5867, 2821,
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

        # Japan vs NA 転売ランキング
        # 各アイテムについて JP最安 vs NA最安 を比較
        arb_base_sql = f"""
            SELECT
                jp.item_id,
                i.name_ja, i.name_en, i.icon_url,
                jp.jp_min, jp.jp_dc,
                na.na_min, na.na_dc,
                LEAST(jp.jp_min, na.na_min) AS buy_price,
                CASE WHEN jp.jp_min < na.na_min THEN jp.jp_dc ELSE na.na_dc END AS buy_info,
                GREATEST(jp.jp_min, na.na_min) AS sell_price,
                CASE WHEN jp.jp_min < na.na_min THEN na.na_dc ELSE jp.jp_dc END AS sell_info,
                ABS(jp.jp_min - na.na_min) AS profit,
                ROUND(ABS(jp.jp_min - na.na_min) / LEAST(jp.jp_min, na.na_min) * 100, 1) AS profit_rate
            FROM (
                SELECT l.item_id,
                    MIN(l.price_per_unit) AS jp_min,
                    SUBSTRING_INDEX(GROUP_CONCAT(w.data_center ORDER BY l.price_per_unit ASC), ',', 1) AS jp_dc
                FROM listings l
                JOIN worlds w ON l.world_id = w.id
                WHERE w.region = 'Japan'
                GROUP BY l.item_id
            ) jp
            JOIN (
                SELECT l.item_id,
                    MIN(l.price_per_unit) AS na_min,
                    SUBSTRING_INDEX(GROUP_CONCAT(w.data_center ORDER BY l.price_per_unit ASC), ',', 1) AS na_dc
                FROM listings l
                JOIN worlds w ON l.world_id = w.id
                WHERE w.region = 'North-America'
                GROUP BY l.item_id
            ) na ON jp.item_id = na.item_id
            JOIN items i ON jp.item_id = i.id
            WHERE jp.item_id NOT IN ({excluded_sql})
                AND LEAST(jp.jp_min, na.na_min) >= 10000
                AND GREATEST(jp.jp_min, na.na_min) < 300000000
                AND ABS(jp.jp_min - na.na_min) > 0
                AND ABS(jp.jp_min - na.na_min) <= 50000000
                AND ROUND(ABS(jp.jp_min - na.na_min) / LEAST(jp.jp_min, na.na_min) * 100, 1) <= 1000
        """

        def parse_arb_rows(result):
            return [
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
                for r in result.all()
            ]

        # 利益率順 TOP20
        logger.info("Calculating arbitrage (rate)...")
        rate_result = await session.execute(
            text(arb_base_sql + " ORDER BY profit_rate DESC LIMIT 20")
        )
        arbitrage_rate = parse_arb_rows(rate_result)

        # 差額順 TOP20
        logger.info("Calculating arbitrage (profit)...")
        profit_result = await session.execute(
            text(arb_base_sql + " ORDER BY profit DESC LIMIT 20")
        )
        arbitrage_profit = parse_arb_rows(profit_result)

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # キャッシュに保存（UPSERT）
        for ranking_type, data in [
            ("expensive", expensive),
            ("arbitrage", arbitrage_rate),
            ("arbitrage_profit", arbitrage_profit),
        ]:
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

        logger.info(f"Rankings updated: {len(expensive)} expensive, {len(arbitrage_rate)} rate, {len(arbitrage_profit)} profit")


async def main():
    logging.basicConfig(level=logging.INFO)
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    await update_rankings(session_factory)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
