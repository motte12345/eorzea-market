from typing import Any

import httpx

from app.config import settings


class XIVAPIClient:
    """XIVAPI クライアント - アイテムマスタ取得用"""

    async def get_item(self, client: httpx.AsyncClient, item_id: int) -> dict[str, Any]:
        """アイテム情報を取得"""
        url = f"{settings.xivapi_base_url}/item/{item_id}"
        response = await client.get(url)
        response.raise_for_status()
        return response.json()

    async def search_items(
        self,
        client: httpx.AsyncClient,
        page: int = 1,
    ) -> dict[str, Any]:
        """アイテム一覧をページネーションで取得"""
        url = f"{settings.xivapi_base_url}/item"
        params = {"page": page, "columns": "ID,Name_ja,Name_en,Icon,ItemSearchCategory.Name_ja,ItemSearchCategory.Name_en"}
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()


xivapi_client = XIVAPIClient()
