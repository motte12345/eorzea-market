"""Universalis API からデータを直接取得してフロント向けに整形（DB保存なし）"""
import httpx
from datetime import datetime, timezone

from app.config import settings

# DC → region マッピング（起動時にキャッシュ）
_dc_region_map: dict[str, str] | None = None


async def _get_dc_region_map() -> dict[str, str]:
    global _dc_region_map
    if _dc_region_map is not None:
        return _dc_region_map

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{settings.universalis_base_url}/data-centers")
        resp.raise_for_status()
        dcs = resp.json()

    _dc_region_map = {}
    for dc in dcs:
        _dc_region_map[dc["name"]] = dc.get("region", "Unknown")
    return _dc_region_map


async def fetch_item_prices_live(item_id: int) -> list[dict]:
    """Universalis API から全ワールドの出品を取得して整形"""
    dc_region = await _get_dc_region_map()

    all_listings = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for dc_name, region in dc_region.items():
            try:
                resp = await client.get(
                    f"{settings.universalis_base_url}/{dc_name}/{item_id}"
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
            except Exception:
                continue

            upload_ts = data.get("lastUploadTime", 0)
            last_upload = (
                datetime.fromtimestamp(upload_ts / 1000, tz=timezone.utc).isoformat()
                if upload_ts
                else None
            )

            for listing in data.get("listings", []):
                all_listings.append({
                    "world_id": listing.get("worldID", 0),
                    "world_name": listing.get("worldName", ""),
                    "data_center": dc_name,
                    "region": region,
                    "price_per_unit": listing.get("pricePerUnit", 0),
                    "quantity": listing.get("quantity", 0),
                    "hq": listing.get("hq", False),
                    "retainer_name": listing.get("retainerName", ""),
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                    "last_upload_at": last_upload,
                })

    all_listings.sort(key=lambda x: x["price_per_unit"])
    return all_listings


async def fetch_item_history_live(item_id: int, limit: int = 50) -> list[dict]:
    """Universalis API から売買履歴を取得"""
    dc_region = await _get_dc_region_map()

    all_sales = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for dc_name, region in dc_region.items():
            try:
                resp = await client.get(
                    f"{settings.universalis_base_url}/{dc_name}/{item_id}"
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
            except Exception:
                continue

            for sale in data.get("recentHistory", []):
                sale_ts = sale.get("timestamp", 0)
                all_sales.append({
                    "price_per_unit": sale.get("pricePerUnit", 0),
                    "quantity": sale.get("quantity", 0),
                    "hq": sale.get("hq", False),
                    "sold_at": (
                        datetime.fromtimestamp(sale_ts, tz=timezone.utc).isoformat()
                        if sale_ts
                        else None
                    ),
                    "world_name": sale.get("worldName", ""),
                    "data_center": dc_name,
                })

    all_sales.sort(key=lambda x: x["sold_at"] or "", reverse=True)
    return all_sales[:limit]
