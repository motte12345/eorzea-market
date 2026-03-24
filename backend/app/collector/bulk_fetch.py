"""人気アイテムの出品データを一括取得"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import delete, insert, select, text
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.collector.universalis_client import universalis_client
from app.config import settings
from app.models.item import Item  # noqa: F401
from app.models.listing import Listing
from app.models.sale_history import SaleHistory
from app.models.world import World

logger = logging.getLogger(__name__)


async def fetch_bulk_listings(
    session_factory: async_sessionmaker,
    item_ids: list[int],
    batch_size: int = 10,
    save_history: bool = False,
) -> None:
    """複数アイテムの出品データをDC単位でバルク取得してDBに格納
    save_history=True の場合は売買履歴も保存（ウォッチリスト用）
    """
    # ワールド・DC マスタ取得
    async with session_factory() as session:
        result = await session.execute(select(World))
        all_worlds = result.scalars().all()
        world_name_to_id = {w.name: w.id for w in all_worlds}
        # DC一覧（重複除去）
        dcs = sorted(set(w.data_center for w in all_worlds))

    total_batches = (len(item_ids) + batch_size - 1) // batch_size

    async with httpx.AsyncClient(timeout=60.0) as client:
        for batch_idx, batch_start in enumerate(
            range(0, len(item_ids), batch_size)
        ):
            batch = item_ids[batch_start : batch_start + batch_size]
            logger.info(
                f"Batch {batch_idx + 1}/{total_batches}: "
                f"items {batch_start + 1}-{min(batch_start + batch_size, len(item_ids))}"
            )

            all_new_listings: list[Listing] = []
            all_new_sales: list[dict] = []
            fetched_item_ids: set[int] = set()
            now = datetime.now(timezone.utc).replace(tzinfo=None)

            for dc in dcs:
                try:
                    data = await universalis_client.get_market_data(
                        client, dc, batch
                    )
                except Exception as e:
                    logger.warning(f"  Failed {dc}: {e}")
                    await asyncio.sleep(1)
                    continue

                # バルクレスポンス: "items" キー、単一: 直接データ
                if "items" in data:
                    items_data = data["items"]
                elif len(batch) == 1:
                    items_data = {str(batch[0]): data}
                else:
                    items_data = {}

                for item_id_str, item_data in items_data.items():
                    item_id = int(item_id_str)
                    fetched_item_ids.add(item_id)

                    # lastUploadTime はミリ秒 Unix timestamp
                    upload_ts = item_data.get("lastUploadTime", 0)
                    last_upload = (
                        datetime.fromtimestamp(upload_ts / 1000, tz=timezone.utc).replace(tzinfo=None)
                        if upload_ts
                        else None
                    )

                    for listing in item_data.get("listings", []):
                        world_name = listing.get("worldName", "")
                        world_id = world_name_to_id.get(world_name)
                        if world_id is None:
                            continue

                        all_new_listings.append(Listing(
                            item_id=item_id,
                            world_id=world_id,
                            price_per_unit=listing.get("pricePerUnit", 0),
                            quantity=listing.get("quantity", 0),
                            total=listing.get("total", 0),
                            hq=listing.get("hq", False),
                            retainer_name=listing.get("retainerName", ""),
                            fetched_at=now,
                            last_upload_at=last_upload,
                        ))

                    # 売買履歴（ウォッチリストのみ）
                    if not save_history:
                        continue
                    for sale in item_data.get("recentHistory", []):
                        world_name = sale.get("worldName", "")
                        world_id = world_name_to_id.get(world_name)
                        if world_id is None:
                            continue

                        sale_ts = sale.get("timestamp", 0)
                        sold_at = (
                            datetime.fromtimestamp(sale_ts, tz=timezone.utc).replace(tzinfo=None)
                            if sale_ts
                            else now
                        )

                        all_new_sales.append({
                            "item_id": item_id,
                            "world_id": world_id,
                            "price_per_unit": sale.get("pricePerUnit", 0),
                            "quantity": sale.get("quantity", 0),
                            "hq": sale.get("hq", False),
                            "sold_at": sold_at,
                            "fetched_at": now,
                        })

                await asyncio.sleep(0.15)  # DC間のレートリミット

            # DB書き込み
            if fetched_item_ids:
                async with session_factory() as session:
                    # listings: 洗い替え
                    await session.execute(
                        delete(Listing).where(
                            Listing.item_id.in_(list(fetched_item_ids))
                        )
                    )
                    session.add_all(all_new_listings)

                    # sale_history: 重複は無視して追記 (INSERT IGNORE)
                    if all_new_sales:
                        stmt = mysql_insert(SaleHistory).values(all_new_sales)
                        stmt = stmt.prefix_with("IGNORE")
                        await session.execute(stmt)

                    await session.commit()

                logger.info(
                    f"  Stored {len(all_new_listings)} listings, "
                    f"{len(all_new_sales)} sales "
                    f"for {len(fetched_item_ids)} items"
                )

            await asyncio.sleep(0.5)


async def get_popular_item_ids(session_factory: async_sessionmaker) -> list[int]:
    """人気アイテムID（カテゴリベースで抽出）"""
    popular_categories = [
        "クリスタル", "石材", "金属材", "木材", "布材", "皮革材",
        "骨材", "錬金術材", "食材", "水産物",
        "薬品", "調理品",
        "主道具", "副道具",
    ]

    async with session_factory() as session:
        conditions = " OR ".join(
            [f"category LIKE :cat{i}" for i in range(len(popular_categories))]
        )
        params = {f"cat{i}": f"%{cat}%" for i, cat in enumerate(popular_categories)}
        result = await session.execute(
            text(f"SELECT id FROM items WHERE {conditions} ORDER BY id LIMIT 500"),
            params,
        )
        ids = [row[0] for row in result.all()]
        return ids


async def main():
    import sys
    logging.basicConfig(level=logging.INFO)

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    if len(sys.argv) > 1 and sys.argv[1] == "--popular":
        item_ids = await get_popular_item_ids(session_factory)
        logger.info(f"Fetching {len(item_ids)} popular items...")
    elif len(sys.argv) > 1:
        item_ids = [int(x) for x in sys.argv[1:]]
    else:
        item_ids = list(range(2, 20))
        logger.info(f"Using default items: {item_ids}")

    await fetch_bulk_listings(session_factory, item_ids)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
