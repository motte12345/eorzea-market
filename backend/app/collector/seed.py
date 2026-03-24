"""マスタデータの初期投入スクリプト"""
import asyncio
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.collector.universalis_client import universalis_client
from app.collector.xivapi_client import xivapi_client
from app.config import settings
from app.database import Base
from app.models.item import Item
from app.models.world import World

logger = logging.getLogger(__name__)


async def seed_worlds(session: AsyncSession) -> None:
    """ワールド・DCマスタを取得してDBに格納"""
    logger.info("Fetching worlds and data centers...")

    dcs = await universalis_client.get_data_centers()
    dc_region_map: dict[str, str] = {}
    dc_worlds_map: dict[str, list[int]] = {}
    for dc in dcs:
        dc_region_map[dc["name"]] = dc["region"]
        dc_worlds_map[dc["name"]] = dc["worlds"]

    worlds = await universalis_client.get_worlds()
    world_dc_map: dict[int, str] = {}
    for dc_name, world_ids in dc_worlds_map.items():
        for wid in world_ids:
            world_dc_map[wid] = dc_name

    count = 0
    for w in worlds:
        world_id = w["id"]
        dc_name = world_dc_map.get(world_id, "Unknown")
        region = dc_region_map.get(dc_name, "Unknown")

        existing = await session.get(World, world_id)
        if existing is None:
            session.add(World(
                id=world_id,
                name=w["name"],
                data_center=dc_name,
                region=region,
            ))
            count += 1

    await session.commit()
    logger.info(f"Seeded {count} worlds")


async def seed_items(session: AsyncSession) -> None:
    """マーケット出品可能アイテムのマスタを取得してDBに格納（バルク取得版）"""
    logger.info("Fetching marketable item IDs...")
    marketable_ids = await universalis_client.get_marketable_items()
    marketable_set = set(marketable_ids)
    logger.info(f"Found {len(marketable_ids)} marketable items")

    # 既存のアイテムIDを取得
    existing_stmt = select(Item.id)
    existing_result = await session.execute(existing_stmt)
    existing_ids = set(existing_result.scalars().all())

    new_ids = marketable_set - existing_ids
    if not new_ids:
        logger.info("All items already seeded")
        return

    logger.info(f"Fetching {len(new_ids)} new items from XIVAPI (bulk)...")

    # XIVAPI のページネーション API で全アイテムを取得し、marketable のもののみDB格納
    async with httpx.AsyncClient(timeout=30.0) as client:
        page = 1
        seeded = 0
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
                if item_id is None or item_id not in new_ids:
                    continue

                category_obj = item_data.get("ItemSearchCategory")
                category = ""
                if isinstance(category_obj, dict):
                    category = category_obj.get("Name_ja", "") or ""

                icon = item_data.get("Icon", "")
                icon_url = f"https://xivapi.com{icon}" if icon else ""

                session.add(Item(
                    id=item_id,
                    name_ja=item_data.get("Name_ja", "") or "",
                    name_en=item_data.get("Name_en", "") or "",
                    icon_url=icon_url,
                    category=category,
                ))
                seeded += 1

            await session.commit()

            page_total = data.get("Pagination", {}).get("PageTotal", 0)
            logger.info(f"Page {page}/{page_total} done, seeded {seeded} items so far")

            if page >= page_total:
                break

            page += 1
            await asyncio.sleep(0.2)  # XIVAPI レートリミット配慮

    logger.info(f"Seeded {seeded} items total")


async def run_seed():
    """シード処理のエントリポイント"""
    logging.basicConfig(level=logging.INFO)

    engine = create_async_engine(settings.database_url)
    async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session_factory() as session:
        await seed_worlds(session)
        await seed_items(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_seed())
