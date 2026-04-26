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
- [x] 全アイテム一括取得スクリプト（fetch_all.py）
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
- [x] リリースノートページ（Markdown管理、日英対応）
- [x] 多言語対応（JP/EN切替、cookie保存）
- [x] DC名表示（ウォッチリスト・検索・カテゴリの価格セル）
- [x] カテゴリ・検索の価格ソート修正（表示リージョンのみ）
- [ ] 価格推移グラフ（Recharts）
- [ ] 利ざやランキング表示

## Phase 5: デプロイ & 仕上げ
- [x] GitHub Actions CI/CD（push to master → 自動デプロイ）
- [x] VPS デプロイ（systemd + Nginx）
- [x] フロントビルドの atomic 化（`.next-new` → mv で差し替え、失敗時も稼働中の.nextは無傷）
- [x] サーバー Swap 2GB 追加（next build の OOM stall 対策）
- [ ] GitHub Actions `command_timeout: 15m` 追記（Web UI で対応、未完）
- [ ] Docker Compose 本番構成

## 今後の候補
- [ ] データ鮮度の表示（価格取得時刻の相対表示）
- [ ] 売れ行き指標（sale_historyから販売頻度）
- [ ] アラート機能（利益率閾値超えで通知）
- [ ] 転売シミュレーション（N個購入時の税引後利益計算）
- [ ] 逆引き検索（リージョン指定で利益が出るアイテム一覧）
- [ ] モバイル対応（テーブルのレスポンシブ改善）
