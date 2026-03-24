"""全マーケット出品可能アイテムのデータを取得"""
import asyncio
import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.collector.bulk_fetch import fetch_bulk_listings
from app.config import settings
from app.models.item import Item  # noqa: F401
from app.models.listing import Listing

logger = logging.getLogger(__name__)


async def main():
    logging.basicConfig(level=logging.INFO)

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # 既にデータがあるアイテムを除外して未取得のアイテムを取得
    async with session_factory() as session:
        result = await session.execute(
            text("""
                SELECT i.id FROM items i
                LEFT JOIN (SELECT DISTINCT item_id FROM listings) l ON i.id = l.item_id
                WHERE l.item_id IS NULL
                ORDER BY i.id
            """)
        )
        remaining_ids = [row[0] for row in result.all()]

    logger.info(f"Remaining items to fetch: {len(remaining_ids)}")

    if not remaining_ids:
        logger.info("All items already fetched!")
        await engine.dispose()
        return

    await fetch_bulk_listings(session_factory, remaining_ids, batch_size=10)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
