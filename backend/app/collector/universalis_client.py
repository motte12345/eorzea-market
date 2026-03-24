import asyncio
from typing import Any

import httpx

from app.config import settings


class UniversalisClient:
    """Universalis API クライアント（レートリミット付き）"""

    def __init__(self):
        self._semaphore = asyncio.Semaphore(int(settings.universalis_rate_limit))
        self._interval = 1.0 / settings.universalis_rate_limit

    async def _request(self, client: httpx.AsyncClient, url: str) -> dict[str, Any]:
        async with self._semaphore:
            response = await client.get(url)
            response.raise_for_status()
            await asyncio.sleep(self._interval)
            return response.json()

    async def get_marketable_items(self) -> list[int]:
        """マーケット出品可能なアイテムID一覧を取得"""
        async with httpx.AsyncClient() as client:
            return await self._request(client, f"{settings.universalis_base_url}/marketable")

    async def get_worlds(self) -> list[dict[str, Any]]:
        """ワールド一覧を取得"""
        async with httpx.AsyncClient() as client:
            return await self._request(client, f"{settings.universalis_base_url}/worlds")

    async def get_data_centers(self) -> list[dict[str, Any]]:
        """DC一覧を取得"""
        async with httpx.AsyncClient() as client:
            return await self._request(client, f"{settings.universalis_base_url}/data-centers")

    async def get_market_data(
        self,
        client: httpx.AsyncClient,
        world_or_dc: str,
        item_ids: list[int],
    ) -> dict[str, Any]:
        """アイテムの市場データを取得（バルク対応、最大100件）"""
        ids_str = ",".join(str(i) for i in item_ids[:100])
        url = f"{settings.universalis_base_url}/{world_or_dc}/{ids_str}"
        return await self._request(client, url)

    async def get_market_data_all_worlds(
        self,
        client: httpx.AsyncClient,
        item_id: int,
    ) -> dict[str, Any]:
        """全ワールドのアイテム市場データを取得"""
        url = f"{settings.universalis_base_url}/{item_id}"
        return await self._request(client, url)


universalis_client = UniversalisClient()
