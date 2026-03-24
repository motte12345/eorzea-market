from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collector.scheduler import mark_items_requested
from app.database import get_db
from app.models.item import Item

router = APIRouter()


# NOTE: 初期実装ではユーザー認証なし。
# watchlist はフロントエンドのローカルストレージで管理し、
# このエンドポイントはアイテムIDリストを受け取って一括価格取得する用途。


@router.post("/prices")
async def get_watchlist_prices(
    item_ids: list[int],
    db: AsyncSession = Depends(get_db),
):
    """ウォッチリストのアイテム価格一覧を一括取得"""
    from app.models.listing import Listing
    from app.models.world import World

    if not item_ids:
        return []

    # ウォッチリストのアイテムを優先更新対象にマーク
    mark_items_requested(item_ids)

    # アイテム情報取得
    items_stmt = select(Item).where(Item.id.in_(item_ids))
    items_result = await db.execute(items_stmt)
    items_map = {item.id: item for item in items_result.scalars().all()}

    # 各アイテムのDC別最安値を取得
    from sqlalchemy import func

    stmt = (
        select(
            Listing.item_id,
            World.region,
            World.data_center,
            World.name.label("world_name"),
            func.min(Listing.price_per_unit).label("min_price"),
        )
        .join(World, Listing.world_id == World.id)
        .where(Listing.item_id.in_(item_ids))
        .group_by(Listing.item_id, World.region, World.data_center, World.name)
        .order_by(Listing.item_id, func.min(Listing.price_per_unit).asc())
    )
    result = await db.execute(stmt)

    # 全アイテムのエントリを先に作成（価格データがなくても表示する）
    watchlist_data = {}
    for item_id in item_ids:
        item = items_map.get(item_id)
        if item is None:
            continue
        watchlist_data[item_id] = {
            "item_id": item_id,
            "name_ja": item.name_ja,
            "name_en": item.name_en,
            "icon_url": item.icon_url,
            "prices_by_dc": [],
        }

    # 価格データがあれば追加
    for row in result.all():
        mapping = dict(row._mapping)
        item_id = mapping["item_id"]
        if item_id in watchlist_data:
            watchlist_data[item_id]["prices_by_dc"].append({
                "region": mapping["region"],
                "data_center": mapping["data_center"],
                "world_name": mapping["world_name"],
                "min_price": mapping["min_price"],
            })

    return list(watchlist_data.values())
