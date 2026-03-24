# TODO.md - Eorzea Market

## Phase 1: 基盤構築
- [x] プロジェクト初期化（backend/frontend/docker-compose）
- [x] DB設計 & SQLAlchemy モデル作成
- [x] Alembic セットアップ & 初期マイグレーション
- [x] Universalis API クライアント実装
- [x] ワールド・DCマスタ取得＆DB格納（seed.py）
- [x] XIVAPI からアイテムマスタ（日本語名）取得＆DB格納（seed.py）

## Phase 2: データ収集
- [x] Collector ジョブ基盤（APScheduler）
- [x] アイテム巡回ロジック（優先度別: ウォッチリスト10分/その他30分）
- [x] listings 洗い替え処理（bulk_fetch.py）
- [x] 手動更新ボタン（2分クールダウン付き）
- [x] 全アイテム一括取得スクリプト（fetch_all.py）※実行中
- [ ] sale_history 追記処理
- [ ] price_summary 日次集計バッチ

## Phase 3: API
- [x] アイテム検索エンドポイント
- [x] アイテム詳細（DC別価格比較）エンドポイント
- [x] DC別統計エンドポイント（/stats）
- [x] 売買履歴エンドポイント（/history）
- [x] ウォッチリスト価格一括取得エンドポイント
- [x] 即時更新エンドポイント（/refresh, クールダウン付き）
- [ ] 価格推移エンドポイント
- [ ] 利ざや計算エンドポイント

## Phase 4: Frontend
- [x] Next.js プロジェクトセットアップ（Tailwind v4, TanStack Query）
- [x] トップページ: サジェスト付き検索バー + ウォッチリスト統合
- [x] アイテム詳細: リージョン/DC/ワールド階層表示、展開/折りたたみ
- [x] ウォッチリスト: DC別価格マトリクス、差益表示、色分け
- [x] HQ/NQフィルタ、売買履歴タブ
- [x] 最終更新時刻表示（last_upload_at）
- [x] 価格更新ボタン
- [ ] 価格推移グラフ（Recharts）
- [ ] 利ざやランキング表示

## Phase 5: デプロイ & 仕上げ
- [ ] Docker Compose 本番構成
- [ ] Nginx 設定
- [ ] VPS デプロイ
