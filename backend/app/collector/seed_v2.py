"""XIVAPI v2 (beta) を使って不足アイテムを補完"""
import asyncio
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.collector.universalis_client import universalis_client
from app.config import settings
from app.models.item import Item

logger = logging.getLogger(__name__)

XIVAPI_V2_BASE = "https://beta.xivapi.com/api/1"


async def fetch_item_v2(client: httpx.AsyncClient, item_id: int) -> dict | None:
    """XIVAPI v2 から日本語・英語名を取得"""
    try:
        # 日本語
        resp_ja = await client.get(
            f"{XIVAPI_V2_BASE}/sheet/Item/{item_id}",
            params={"fields": "Name,Icon,ItemSearchCategory.Name", "language": "ja"},
        )
        if resp_ja.status_code != 200:
            return None
        data_ja = resp_ja.json()

        # 英語
        resp_en = await client.get(
            f"{XIVAPI_V2_BASE}/sheet/Item/{item_id}",
            params={"fields": "Name,Icon,ItemSearchCategory.Name", "language": "en"},
        )
        data_en = resp_en.json() if resp_en.status_code == 200 else {}

        icon_data = data_ja.get("fields", {}).get("Icon", {})
        icon_id = icon_data.get("id", 0)
        # アイコンURL: xivapi.com のCDNパス
        icon_url = f"https://xivapi.com/i/{str(icon_id).zfill(6)[:3]}000/{str(icon_id).zfill(6)}.png" if icon_id else ""

        category_obj = data_ja.get("fields", {}).get("ItemSearchCategory", {})
        category = ""
        if isinstance(category_obj, dict):
            fields = category_obj.get("fields", {})
            category = fields.get("Name", "") if isinstance(fields, dict) else ""

        return {
            "id": item_id,
            "name_ja": data_ja.get("fields", {}).get("Name", ""),
            "name_en": data_en.get("fields", {}).get("Name", ""),
            "icon_url": icon_url,
            "category": category,
        }
    except Exception as e:
        logger.warning(f"Failed to fetch item {item_id}: {e}")
        return None


async def seed_missing_items():
    """Universalis の marketable リストにあるがDBに無いアイテムを補完"""
    logging.basicConfig(level=logging.INFO)

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # marketable アイテムID取得
    marketable_ids = set(await universalis_client.get_marketable_items())
    logger.info(f"Universalis marketable: {len(marketable_ids)}")

    # DB既存ID取得
    async with session_factory() as session:
        result = await session.execute(select(Item.id))
        existing_ids = set(result.scalars().all())

    missing_ids = sorted(marketable_ids - existing_ids)
    logger.info(f"Missing items: {len(missing_ids)}")

    if not missing_ids:
        logger.info("All items already in DB!")
        await engine.dispose()
        return

    # XIVAPI v2 で取得
    async with httpx.AsyncClient(timeout=15.0) as client:
        batch_size = 20
        seeded = 0
        for i in range(0, len(missing_ids), batch_size):
            batch = missing_ids[i:i + batch_size]
            items_to_add = []

            for item_id in batch:
                data = await fetch_item_v2(client, item_id)
                if data:
                    items_to_add.append(Item(**data))
                await asyncio.sleep(0.05)

            if items_to_add:
                async with session_factory() as session:
                    session.add_all(items_to_add)
                    await session.commit()
                    seeded += len(items_to_add)

            logger.info(f"Progress: {min(i + batch_size, len(missing_ids))}/{len(missing_ids)}, seeded {seeded}")
            await asyncio.sleep(0.2)

    logger.info(f"Done! Seeded {seeded} items total")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_missing_items())
