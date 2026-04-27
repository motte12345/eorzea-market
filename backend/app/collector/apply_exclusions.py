"""申請されたアイテムをランキング除外として正式登録する管理スクリプト

Usage:
    PYTHONPATH=. python -m app.collector.apply_exclusions [--dry-run] [--min-count N]
"""
import argparse
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.collector.update_ranking import update_rankings
from app.config import settings
from app.models.exclusion import ExcludedItem, ExclusionRequest

logger = logging.getLogger(__name__)


async def apply_exclusions(
    session_factory: async_sessionmaker,
    *,
    dry_run: bool = False,
    min_count: int = 1,
) -> list[int]:
    """request_count >= min_count の申請を excluded_items に昇格"""
    async with session_factory() as session:
        result = await session.execute(
            select(ExclusionRequest).where(ExclusionRequest.request_count >= min_count)
        )
        requests = list(result.scalars().all())
        if not requests:
            logger.info("No pending exclusion requests")
            return []

        already = await session.execute(
            select(ExcludedItem.item_id).where(
                ExcludedItem.item_id.in_([r.item_id for r in requests])
            )
        )
        already_ids = {row[0] for row in already.all()}

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        promoted: list[int] = []
        for req in requests:
            if req.item_id in already_ids:
                logger.info("Item %d already excluded, skipping", req.item_id)
                continue
            promoted.append(req.item_id)
            if not dry_run:
                session.add(
                    ExcludedItem(
                        item_id=req.item_id,
                        excluded_at=now,
                        reason=f"user_request (count={req.request_count})",
                    )
                )

        if dry_run:
            logger.info("[dry-run] would promote: %s", promoted)
            return promoted

        if requests:
            await session.execute(
                delete(ExclusionRequest).where(
                    ExclusionRequest.item_id.in_([r.item_id for r in requests])
                )
            )
        await session.commit()
        logger.info("Promoted %d items, removed %d requests", len(promoted), len(requests))
        return promoted


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="変更せず対象を表示するだけ")
    parser.add_argument("--min-count", type=int, default=1, help="この申請数以上を承認")
    parser.add_argument("--no-rebuild", action="store_true", help="ランキング再計算をスキップ")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        promoted = await apply_exclusions(
            session_factory, dry_run=args.dry_run, min_count=args.min_count
        )
        if promoted and not args.dry_run and not args.no_rebuild:
            logger.info("Rebuilding rankings...")
            await update_rankings(session_factory)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
