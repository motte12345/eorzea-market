# SPEC.md - Eorzea Market

## 概要
FFXIV 全サーバーのマーケットボードデータを収集・蓄積し、**DC間転売（アービトラージ）** を支援するWebサイト。
他の人にも見せられるモダンなUI。

## コアユースケース
DC間転売: 同じアイテムのDC間価格差を見つけて利ざやを稼ぐ。
→ ウォッチリストに登録したアイテムについて、各DC（各サーバー）の最安/最高値が一目でわかるダッシュボードが中心。

## データソース
- **Universalis API** (https://universalis.app)
  - 認証不要、CORS有効
  - レートリミット: 14 req/s
  - 複数アイテム一括取得可能
  - エンドポイント:
    - `/api/v2/{world|dc|region}/{itemId}` - 現在の出品＋直近売買履歴
    - `/api/v2/marketable` - マーケット出品可能アイテムID一覧
    - `/api/v2/worlds` - ワールド一覧
    - `/api/v2/data-centers` - DC一覧

## 主要機能

### 1. サーバー間価格比較
- 指定アイテムの全サーバー最安値一覧
- HQ/NQ 別表示
- DC単位でのグルーピング

### 2. 価格推移グラフ
- 日次/週次/月次の価格推移
- 出来高（売買数量）表示
- HQ/NQ 別ライン

### 3. ウォッチリスト（メイン機能）
- 個人ごとのウォッチリスト（ローカルストレージ or ユーザー認証後はDB保存）
- 登録アイテムのDC別価格マトリクス表示:
  ```
  アイテム名  | Japan最安 | NA最安  | EU最安  | OCE最安 | 最大差益
  闇霊銀砂    | 1,200(Tonberry) | 800(Cactuar) | 1,500(Cerberus) | ... | 700gil
  ```
- サーバー単位での展開表示も可能
- HQ/NQ 切り替え

### 4. 利ざや（転売差益）計算
- ウォッチリスト内アイテムのDC間価格差を自動計算
- 税込み利益計算（都市別税率考慮）
- 差益率でソート・フィルタ

### 5. アイテム検索
- 名前でアイテム検索
- カテゴリ別ブラウズ

## 技術スタック

### Backend
- **Python 3.12+ / FastAPI** - API サーバー
- **SQLAlchemy + Alembic** - ORM / マイグレーション
- **PostgreSQL** - メインDB（価格履歴の蓄積）
- **APScheduler** or **Celery** - 定期データ収集ジョブ
- **httpx** - Universalis API クライアント

### Frontend
- **Next.js 15 (App Router)** - React フレームワーク
- **Tailwind CSS** - スタイリング
- **shadcn/ui** - UIコンポーネント
- **Recharts** - グラフ描画
- **TanStack Query** - データフェッチ＆キャッシュ

### Infrastructure
- **VPS** (1台構成)
- **Docker Compose** - コンテナ管理
- **Nginx** - リバースプロキシ
- **GitHub Actions** - CI/CD（任意）

## DB設計（概要）

### items
アイテムマスタ（Universalis の marketable リストから取得）
- id (int, PK) - ゲーム内アイテムID
- name_ja, name_en (text)
- icon_url (text)
- category (text)

### worlds
ワールドマスタ
- id (int, PK)
- name (text)
- data_center (text)
- region (text)

### listings (現在の出品 - 定期的に洗い替え)
- item_id, world_id
- price_per_unit, quantity, total
- hq (bool)
- retainer_name
- fetched_at (timestamp)

### sale_history (売買履歴 - 追記のみ)
- item_id, world_id
- price_per_unit, quantity
- hq (bool)
- sold_at (timestamp)
- fetched_at (timestamp)

### price_summary (日次集計)
- item_id, world_id, date
- min_price, avg_price, max_price
- volume (出来高)
- hq (bool)

### watchlist
- user_id (将来的にユーザー管理するなら)
- item_id

## データ収集戦略（2層構成）

### Tier 1: ウォッチリスト登録アイテム（DB保存）
- APScheduler で10分間隔で自動更新
- listings: 洗い替え、sale_history: 追記（90日保持）
- price_summary: 日次集計（長期保持）
- 手動更新ボタンあり（2分クールダウン）

### Tier 2: それ以外のアイテム（APIプロキシ）
- ページ表示時に Universalis API を直接プロキシして返す
- DB保存しない（API負荷・DB容量を節約）
- 毎日4:00にウォッチリスト外の古いデータをクリーンアップ

## ディレクトリ構成（案）

```
eorzea-market/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI ルーター
│   │   ├── collector/    # データ収集ジョブ
│   │   ├── models/       # SQLAlchemy モデル
│   │   ├── schemas/      # Pydantic スキーマ
│   │   ├── services/     # ビジネスロジック
│   │   └── main.py
│   ├── alembic/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── CLAUDE.md
├── SPEC.md
├── TODO.md
└── KNOWLEDGE.md
```

## アイテム名 日本語データ
- **XIVAPI** (https://xivapi.com) からアイテム名(ja/en)を取得してDBに格納
- 初回セットアップ時に一括取得、パッチ更新時に差分更新

## 未決事項
- [ ] ユーザー認証方式（初期はローカルストレージでウォッチリスト管理、後でログイン追加?）
- [ ] アラート通知手段（Discord webhook?）
