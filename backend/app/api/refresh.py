"""アイテムの即時データ更新エンドポイント"""
from datetime import datetime, timezone
from threading import Lock

from fastapi import APIRouter, HTTPException

from app.collector.bulk_fetch import fetch_bulk_listings
from app.collector.scheduler import mark_items_requested
from app.config import settings

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

router = APIRouter()

_engine = None
_session_factory = None

# アイテムごとのクールダウン（秒）
COOLDOWN_SECONDS = 120
_last_refresh: dict[int, float] = {}
_refresh_lock = Lock()


def _get_session_factory():
    global _engine, _session_factory
    if _session_factory is None:
        _engine = create_async_engine(settings.database_url)
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _session_factory


@router.post("/{item_id}")
async def refresh_item(item_id: int):
    """指定アイテムの価格データを即時更新（2分間のクールダウン付き）"""
    now = datetime.now(timezone.utc).timestamp()

    with _refresh_lock:
        last = _last_refresh.get(item_id, 0)
        remaining = COOLDOWN_SECONDS - (now - last)
        if remaining > 0:
            raise HTTPException(
                status_code=429,
                detail=f"あと{int(remaining)}秒後に再更新できます",
            )
        _last_refresh[item_id] = now

    mark_items_requested([item_id])
    session_factory = _get_session_factory()

    try:
        await fetch_bulk_listings(session_factory, [item_id], batch_size=1)
    except Exception as e:
        # 失敗時はクールダウンをリセット
        with _refresh_lock:
            _last_refresh.pop(item_id, None)
        raise HTTPException(status_code=502, detail=f"Failed to fetch: {e}")

    return {"status": "ok", "item_id": item_id}
