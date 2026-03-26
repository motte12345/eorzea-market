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
            Item.category_en,
            func.count(Item.id).label("item_count"),
        )
        .where(Item.category != "")
        .group_by(Item.category, Item.category_en)
        .order_by(Item.category)
    )
    result = await db.execute(stmt)
    return [
        {
            "category": row.category,
            "category_en": row.category_en,
            "item_count": row.item_count,
        }
        for row in result.all()
    ]


@router.get("/{category}/items")
async def get_category_items(
    category: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, le=200),
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

    from sqlalchemy import case, literal

    min_price_expr = func.min(Listing.price_per_unit)
    has_price = case((min_price_expr.is_(None), literal(1)), else_=literal(0))

    if sort == "price_asc":
        stmt = stmt.order_by(has_price, min_price_expr.asc())
    elif sort == "price_desc":
        stmt = stmt.order_by(has_price, min_price_expr.desc())
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
