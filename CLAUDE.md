# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要
FFXIV マーケットボード データ収集＆DC間転売支援サイト。
Universalis API から全サーバーの価格データを収集し、ウォッチリスト中心のダッシュボードで表示する。

## 技術スタック
- **Backend**: Python 3.11+ / FastAPI / SQLAlchemy / Alembic / MySQL 8.0
- **Frontend**: Next.js 15 (App Router) / Tailwind CSS v4 / Recharts / TanStack Query
- **Infrastructure**: VPS / Nginx

## コマンド

### Backend
```bash
cd backend
source .venv/Scripts/activate                    # venv有効化 (Windows)
pip install -r requirements.txt                  # 依存インストール
PYTHONPATH=. uvicorn app.main:app --reload       # 開発サーバー起動 (port 8000)
PYTHONPATH=. alembic upgrade head                # DBマイグレーション適用
PYTHONPATH=. alembic revision --autogenerate -m "msg"  # マイグレーション生成
PYTHONPATH=. python -m app.collector.seed        # マスタデータ投入
PYTHONPATH=. pytest                              # テスト全実行
PYTHONPATH=. pytest tests/test_xxx.py::test_func # 単体テスト実行
```

### Frontend
```bash
cd frontend
npm install                # 依存インストール
npm run dev                # 開発サーバー起動 (port 3000)
npm run build              # プロダクションビルド
npm run lint               # ESLint
```


## アーキテクチャ

### データフロー
```
Universalis API → Collector (定期ジョブ) → MySQL → FastAPI → Next.js Frontend
                                              ↑
XIVAPI → アイテムマスタ取得 (初回/パッチ時) ──┘
```

### Backend 構成 (backend/app/)
- `api/` - FastAPI ルーター（REST エンドポイント）
- `collector/` - Universalis API からのデータ収集ジョブ（APScheduler）
- `models/` - SQLAlchemy モデル（items, worlds, listings, sale_history, price_summary）
- `schemas/` - Pydantic リクエスト/レスポンススキーマ
- `services/` - ビジネスロジック（価格比較、利ざや計算）

### Frontend 構成 (frontend/src/)
- `app/` - Next.js App Router ページ
- `components/` - UIコンポーネント（shadcn/ui ベース）
- `lib/` - APIクライアント、ユーティリティ

### 主要テーブル
- **items** - アイテムマスタ（name_ja, name_en, icon_url, category）
- **worlds** - ワールドマスタ（name, data_center, region）
- **listings** - 現在の出品（定期洗い替え）
- **sale_history** - 売買履歴（追記のみ）
- **price_summary** - 日次集計（min/avg/max/volume）

## 外部API
- **Universalis API**: レートリミット 14 req/s。バルクエンドポイント活用必須。
- **XIVAPI**: アイテム名（日本語/英語）取得用。

## コアユースケース
DC間転売: ウォッチリストに登録したアイテムのDC間価格差を表示し、転売機会を見つける。
UIの中心はウォッチリストのDC別価格マトリクス。
