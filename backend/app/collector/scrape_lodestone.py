"""Lodestone からアイテムのハッシュIDをスクレイピング"""
import asyncio
import logging
import re
from urllib.parse import quote

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.item import Item

logger = logging.getLogger(__name__)

LODESTONE_SEARCH_URL = "https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/"
ITEM_ENTRY_PATTERN = re.compile(
    r'<a href="/lodestone/playguide/db/item/([a-f0-9]{8,})/\?patch="'
    r'[^>]*class="[^"]*db-table__txt--detail_link[^"]*"[^>]*>'
    r'([^<]+)</a>',
)
REQUEST_INTERVAL = 3.0  # 秒


async def search_lodestone_id(client: httpx.AsyncClient, item_name: str) -> str | None:
    """アイテム名で Lodestone を完全一致検索し、ハッシュIDを取得"""
    try:
        # ""で囲んで完全一致検索
        resp = await client.get(
            LODESTONE_SEARCH_URL,
            params={
                "patch": "",
                "db_search_category": "item",
                "category2": "",
                "q": f'"{item_name}"',
            },
        )
        if resp.status_code != 200:
            return None

        html = resp.text
        # アイテム名とIDのペアを抽出して名前が一致するものを選択
        for match in ITEM_ENTRY_PATTERN.finditer(html):
            lodestone_id = match.group(1)
            found_name = match.group(2).strip()
            if found_name == item_name:
                return lodestone_id

        # 完全一致がなければ最初の結果を使う
        matches = ITEM_ENTRY_PATTERN.findall(html)
        if matches:
            return matches[0][0]

        return None
    except Exception as e:
        logger.warning(f"Failed to search '{item_name}': {e}")
        return None


async def scrape_lodestone_ids():
    """lodestone_id が未設定のアイテムについてスクレイピング"""
    logging.basicConfig(level=logging.INFO)

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # lodestone_id が NULL で name_ja が空でないアイテムを取得
    async with session_factory() as session:
        result = await session.execute(
            select(Item)
            .where(Item.lodestone_id.is_(None), Item.name_ja != "")
            .order_by(Item.id)
        )
        items = result.scalars().all()

    logger.info(f"Items to scrape: {len(items)}")

    if not items:
        logger.info("All items already have lodestone_id!")
        await engine.dispose()
        return

    async with httpx.AsyncClient(timeout=15.0) as client:
        success = 0
        failed = 0

        for i, item in enumerate(items):
            lodestone_id = await search_lodestone_id(client, item.name_ja)

            if lodestone_id:
                async with session_factory() as session:
                    db_item = await session.get(Item, item.id)
                    if db_item:
                        db_item.lodestone_id = lodestone_id
                        await session.commit()
                success += 1
            else:
                failed += 1

            if (i + 1) % 50 == 0 or i == len(items) - 1:
                logger.info(
                    f"Progress: {i + 1}/{len(items)} "
                    f"(success: {success}, failed: {failed})"
                )

            await asyncio.sleep(REQUEST_INTERVAL)

    logger.info(f"Done! success: {success}, failed: {failed}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(scrape_lodestone_ids())
