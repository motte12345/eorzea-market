"""売買履歴から日次価格サマリーを集計"""
import asyncio
import logging
from datetime import date, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.item import Item  # noqa: F401
from app.models.sale_history import SaleHistory
from app.models.price_summary import PriceSummary
from app.models.world import World  # noqa: F401

logger = logging.getLogger(__name__)


async def summarize_day(
    session_factory: async_sessionmaker,
    target_date: date,
) -> None:
    """指定日の売買履歴から価格サマリーを集計"""
    next_date = target_date + timedelta(days=1)

    async with session_factory() as session:
        # 売買履歴から集計
        stmt = (
            select(
                SaleHistory.item_id,
                SaleHistory.world_id,
                SaleHistory.hq,
                func.min(SaleHistory.price_per_unit).label("min_price"),
                func.avg(SaleHistory.price_per_unit).label("avg_price"),
                func.max(SaleHistory.price_per_unit).label("max_price"),
                func.sum(SaleHistory.quantity).label("volume"),
            )
            .where(
                SaleHistory.sold_at >= target_date,
                SaleHistory.sold_at < next_date,
            )
            .group_by(SaleHistory.item_id, SaleHistory.world_id, SaleHistory.hq)
        )
        result = await session.execute(stmt)
        rows = result.all()

        if not rows:
            logger.info(f"No sales data for {target_date}")
            return

        # UPSERT (INSERT ... ON DUPLICATE KEY UPDATE)
        values = [
            {
                "item_id": row.item_id,
                "world_id": row.world_id,
                "date": target_date,
                "hq": row.hq,
                "min_price": row.min_price,
                "avg_price": int(row.avg_price),
                "max_price": row.max_price,
                "volume": int(row.volume),
            }
            for row in rows
        ]

        stmt = mysql_insert(PriceSummary).values(values)
        stmt = stmt.on_duplicate_key_update(
            min_price=stmt.inserted.min_price,
            avg_price=stmt.inserted.avg_price,
            max_price=stmt.inserted.max_price,
            volume=stmt.inserted.volume,
        )
        await session.execute(stmt)
        await session.commit()

        logger.info(f"Summarized {target_date}: {len(values)} records")


async def summarize_recent(
    session_factory: async_sessionmaker,
    days: int = 7,
) -> None:
    """直近N日分の集計を実行"""
    today = date.today()
    for i in range(days, -1, -1):
        target = today - timedelta(days=i)
        await summarize_day(session_factory, target)


async def main():
    import sys
    logging.basicConfig(level=logging.INFO)

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    await summarize_recent(session_factory, days)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
