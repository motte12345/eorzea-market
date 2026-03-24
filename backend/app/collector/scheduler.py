"""定期データ収集スケジューラー"""
import logging
from datetime import datetime, timedelta, timezone
from threading import Lock

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.collector.bulk_fetch import fetch_bulk_listings
from app.models.item import Item  # noqa: F401
from app.models.listing import Listing
from app.models.sale_history import SaleHistory

logger = logging.getLogger(__name__)

# 最近リクエストされたアイテムID（ウォッチリスト等）
_requested_items: dict[int, datetime] = {}
_lock = Lock()

# 設定
PRIORITY_INTERVAL_MINUTES = 10   # ウォッチリスト更新間隔
REQUEST_EXPIRY_MINUTES = 60      # リクエストの有効期限
HISTORY_RETENTION_DAYS = 90      # sale_history 保持日数
STALE_THRESHOLD_MINUTES = 120    # listings の鮮度閾値


def mark_items_requested(item_ids: list[int]) -> None:
    """アイテムがリクエストされたことを記録"""
    now = datetime.now(timezone.utc)
    with _lock:
        for item_id in item_ids:
            _requested_items[item_id] = now


def get_priority_item_ids() -> list[int]:
    """優先更新対象のアイテムIDを取得（最近リクエストされたもの）"""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=REQUEST_EXPIRY_MINUTES)
    with _lock:
        expired = [k for k, v in _requested_items.items() if v < cutoff]
        for k in expired:
            del _requested_items[k]
        return list(_requested_items.keys())


async def refresh_priority_items(session_factory: async_sessionmaker) -> None:
    """ウォッチリストアイテムを更新（出品 + 売買履歴）"""
    item_ids = get_priority_item_ids()
    if not item_ids:
        return

    logger.info(f"Priority refresh: {len(item_ids)} items (with history)")
    await fetch_bulk_listings(
        session_factory, item_ids, batch_size=10, save_history=True
    )


async def refresh_stale_listings(session_factory: async_sessionmaker) -> None:
    """古い出品データを更新（出品のみ、売買履歴は保存しない）"""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=STALE_THRESHOLD_MINUTES)
    cutoff_naive = cutoff.replace(tzinfo=None)

    async with session_factory() as session:
        result = await session.execute(
            text("""
                SELECT i.id FROM items i
                LEFT JOIN (
                    SELECT item_id, MAX(fetched_at) as last_fetched
                    FROM listings GROUP BY item_id
                ) l ON i.id = l.item_id
                WHERE l.last_fetched IS NULL OR l.last_fetched < :cutoff
                ORDER BY COALESCE(l.last_fetched, '2000-01-01') ASC
                LIMIT 100
            """),
            {"cutoff": cutoff_naive},
        )
        stale_ids = [row[0] for row in result.all()]

    if not stale_ids:
        return

    logger.info(f"Stale refresh: {len(stale_ids)} items (listings only)")
    await fetch_bulk_listings(
        session_factory, stale_ids, batch_size=10, save_history=False
    )


async def cleanup_old_data(session_factory: async_sessionmaker) -> None:
    """古い売買履歴を削除"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=HISTORY_RETENTION_DAYS)
    cutoff_naive = cutoff.replace(tzinfo=None)

    async with session_factory() as session:
        result = await session.execute(
            delete(SaleHistory).where(SaleHistory.sold_at < cutoff_naive)
        )
        old_sales = result.rowcount
        await session.commit()

        if old_sales > 0:
            logger.info(f"Cleanup: removed {old_sales} old sale records")


def create_scheduler(session_factory: async_sessionmaker) -> AsyncIOScheduler:
    """スケジューラーを作成"""
    scheduler = AsyncIOScheduler()

    # ウォッチリストアイテムの定期更新（出品 + 売買履歴）
    scheduler.add_job(
        refresh_priority_items,
        "interval",
        minutes=PRIORITY_INTERVAL_MINUTES,
        args=[session_factory],
        id="priority_refresh",
        name="Priority items refresh",
        max_instances=1,
    )

    # 全アイテムの出品データ巡回（売買履歴なし）
    scheduler.add_job(
        refresh_stale_listings,
        "interval",
        minutes=30,
        args=[session_factory],
        id="stale_refresh",
        name="Stale listings refresh",
        max_instances=1,
    )

    # 日次集計（毎時0分）
    from app.collector.summarize import summarize_recent

    scheduler.add_job(
        summarize_recent,
        "cron",
        hour="*",
        minute=0,
        args=[session_factory, 1],
        id="daily_summary",
        name="Daily price summary",
        max_instances=1,
    )

    # 古いデータのクリーンアップ（毎日4:00）
    scheduler.add_job(
        cleanup_old_data,
        "cron",
        hour=4,
        minute=0,
        args=[session_factory],
        id="cleanup",
        name="Old data cleanup",
        max_instances=1,
    )

    return scheduler
