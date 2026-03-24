"""指定アイテムの出品データを Universalis API から取得してDBに格納"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.collector.universalis_client import universalis_client
from app.config import settings
from app.models.item import Item  # noqa: F401 - needed for FK resolution
from app.models.listing import Listing
from app.models.world import World

logger = logging.getLogger(__name__)


async def fetch_and_store_listings(
    session_factory: async_sessionmaker,
    item_ids: list[int],
) -> None:
    """アイテムの出品データを全ワールドから取得してDBに格納"""
    async with session_factory() as session:
        # ワールドマスタ取得
        result = await session.execute(select(World))
        worlds = {w.name: w.id for w in result.scalars().all()}

    # リージョン一覧
    regions = ["Japan", "North-America", "Europe", "Oceania"]

    async with httpx.AsyncClient(timeout=30.0) as client:
        for item_id in item_ids:
            all_listings_data = []
            for region in regions:
                try:
                    data = await universalis_client.get_market_data(client, region, [item_id])
                except Exception as e:
                    logger.warning(f"Failed to fetch item {item_id} for {region}: {e}")
                    continue
                all_listings_data.extend(data.get("listings", []))

            now = datetime.now(timezone.utc).replace(tzinfo=None)
            new_listings = []

            listings_data = all_listings_data
            for listing in listings_data:
                world_name = listing.get("worldName", "")
                world_id = worlds.get(world_name)
                if world_id is None:
                    continue

                new_listings.append(Listing(
                    item_id=item_id,
                    world_id=world_id,
                    price_per_unit=listing.get("pricePerUnit", 0),
                    quantity=listing.get("quantity", 0),
                    total=listing.get("total", 0),
                    hq=listing.get("hq", False),
                    retainer_name=listing.get("retainerName", ""),
                    fetched_at=now,
                ))

            # 既存の出品を削除して新しいデータで置き換え
            async with session_factory() as session:
                await session.execute(
                    delete(Listing).where(Listing.item_id == item_id)
                )
                session.add_all(new_listings)
                await session.commit()

            logger.info(f"Item {item_id}: stored {len(new_listings)} listings")


async def main():
    """テスト用: 引数で指定したアイテムIDのデータを取得"""
    import sys
    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) < 2:
        # デフォルト: よく取引されるアイテム
        item_ids = [5111, 5106, 5108, 5110, 5112, 5114]  # クリスタル系素材
        logger.info(f"No item IDs specified, using defaults: {item_ids}")
    else:
        item_ids = [int(x) for x in sys.argv[1:]]

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    await fetch_and_store_listings(session_factory, item_ids)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
