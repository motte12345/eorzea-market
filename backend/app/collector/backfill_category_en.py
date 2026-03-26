"""既存アイテムの category_en を XIVAPI から取得して埋めるスクリプト"""
import asyncio
import logging

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.collector.xivapi_client import xivapi_client
from app.config import settings
from app.models.item import Item

logger = logging.getLogger(__name__)


async def backfill_category_en() -> None:
    logging.basicConfig(level=logging.INFO)

    engine = create_async_engine(settings.database_url)
    async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session_factory() as session:
        # category_en が空のアイテムIDを取得
        stmt = select(Item.id).where(Item.category_en == "")
        result = await session.execute(stmt)
        target_ids = set(result.scalars().all())

        if not target_ids:
            logger.info("All items already have category_en")
            await engine.dispose()
            return

        logger.info(f"Backfilling category_en for {len(target_ids)} items...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            page = 1
            updated = 0
            while True:
                try:
                    data = await xivapi_client.search_items(client, page=page)
                except Exception as e:
                    logger.warning(f"Failed to fetch page {page}: {e}")
                    break

                results = data.get("Results", [])
                if not results:
                    break

                for item_data in results:
                    item_id = item_data.get("ID")
                    if item_id is None or item_id not in target_ids:
                        continue

                    category_obj = item_data.get("ItemSearchCategory")
                    category_en = ""
                    if isinstance(category_obj, dict):
                        category_en = category_obj.get("Name_en", "") or ""

                    if category_en:
                        await session.execute(
                            update(Item)
                            .where(Item.id == item_id)
                            .values(category_en=category_en)
                        )
                        updated += 1

                await session.commit()

                page_total = data.get("Pagination", {}).get("PageTotal", 0)
                logger.info(f"Page {page}/{page_total}, updated {updated} items")

                if page >= page_total:
                    break

                page += 1
                await asyncio.sleep(0.2)

        logger.info(f"Backfill complete: {updated} items updated")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(backfill_category_en())
