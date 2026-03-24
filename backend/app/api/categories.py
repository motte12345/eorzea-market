"""カテゴリ（タグ）API"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.item import Item

router = APIRouter()


@router.get("/")
async def get_categories(db: AsyncSession = Depends(get_db)):
    """カテゴリ一覧（アイテム数付き）"""
    stmt = (
        select(
            Item.category,
            func.count(Item.id).label("item_count"),
        )
        .where(Item.category != "")
        .group_by(Item.category)
        .order_by(Item.category)
    )
    result = await db.execute(stmt)
    return [
        {"category": row.category, "item_count": row.item_count}
        for row in result.all()
    ]


@router.get("/{category}/items")
async def get_category_items(
    category: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, le=100),
    sort: str = Query("name", regex="^(name|price_asc|price_desc)$"),
    db: AsyncSession = Depends(get_db),
):
    """カテゴリ別アイテム一覧（ページネーション付き）"""
    from app.models.listing import Listing

    # 総件数
    count_stmt = select(func.count(Item.id)).where(Item.category == category)
    total = (await db.execute(count_stmt)).scalar() or 0

    # アイテム + 最安値
    stmt = (
        select(
            Item.id,
            Item.name_ja,
            Item.name_en,
            Item.icon_url,
            Item.category,
            func.min(Listing.price_per_unit).label("min_price"),
        )
        .outerjoin(Listing, Item.id == Listing.item_id)
        .where(Item.category == category)
        .group_by(Item.id, Item.name_ja, Item.name_en, Item.icon_url, Item.category)
    )

    if sort == "price_asc":
        stmt = stmt.order_by(func.min(Listing.price_per_unit).asc().nulls_last())
    elif sort == "price_desc":
        stmt = stmt.order_by(func.min(Listing.price_per_unit).desc().nulls_last())
    else:
        stmt = stmt.order_by(Item.name_ja)

    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [
            {
                "id": r.id,
                "name_ja": r.name_ja,
                "name_en": r.name_en,
                "icon_url": r.icon_url,
                "min_price": r.min_price,
            }
            for r in result.all()
        ],
    }
