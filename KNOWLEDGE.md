# KNOWLEDGE.md - Eorzea Market

## 学び・注意点

### Universalis API
- リージョン単位でバルク50件は504 Timeout → DC単位 × バッチ10件が安定
- `NA Cloud DC (Beta)` は常に404を返す → 無視してOK（警告ログは出る）
- `lastUploadTime` はミリ秒 Unix timestamp
- バルクレスポンスは `items` キーの下にアイテムIDをキーとした dict

### XIVAPI
- 1件ずつ取得は15,000件で数時間 → ページネーションAPI (`/item?page=N`) で一括が高速
- レスポンスの日本語テキストは正しくUTF-8エンコードされている
- Windows ターミナルでの文字化けはcp932の表示問題で、データ自体は正常

### Windows 開発環境
- uvicorn の `--reload` が変更を検知しないことがある → python プロセスを全殺しして再起動が確実
- `taskkill //F //IM python3.11.exe` はバックグラウンドジョブも殺すので注意
- 複数の uvicorn が同一ポートで LISTENING 状態になることがある → netstat で確認
- Node.js のパスは `/c/Program Files/nodejs` を PATH に追加が必要
- Next.js dev サーバーも Node プロセスが残りがち → `taskkill //F //IM node.exe` で掃除

### DB (MySQL 8.0)
- `charset=utf8mb4` を接続文字列に含める
- SQLAlchemy の async ドライバーは `aiomysql`、sync は `pymysql`
- Alembic 実行時は `PYTHONPATH=.` が必要

### Next.js (v15)
- localStorage を使うコンポーネントは Hydration mismatch に注意
  - サーバーでは localStorage が存在しない → useEffect で初期化する
  - 例: isInWatchlist() を直接テンプレートで使うとエラー → state経由にする

### DC部分失敗でデータが消える問題（2026-04-22 修正）
- 旧コード: `fetch_bulk_listings` は、あるアイテムがどこか1DCから取れたら、そのアイテムの全DC listingsを一括削除 → 失敗したDCの既存データが消えていた
- Universalis APIは個別DCだけ 504/timeout を返すことが日常的にあり、表示DCが虫食いになる原因だった
- 修正: `_fetch_dc` に成功フラグを追加、削除対象を「成功したDCのworld_idsかつfetched item_ids」に絞る。失敗DCは完全スキップで既存データ温存
- 同じバグが `api/items.py::_save_proxy_listings` にもあった（プロキシフォールバック経路）。こちらも listings に含まれる world_id のみ削除に変更
- 教訓: 「洗い替え」系の処理は、取得失敗と「取得成功かつ空」を必ず区別する

### 価格データのリージョン問題
- ウォッチリストAPI (`/watchlist/prices`) は中国・台湾・韓国サーバーのデータも返す
- フロントは JP/NA/EU/OCE の4リージョンのみ表示
- ソートや集計で `prices_by_dc` を使う際は、表示対象リージョンでフィルタしないと不一致が起きる
- カテゴリAPIの `min_price`（LEFT JOIN listings）も全サーバー含むので同様
- 対処: `minPriceMap` を `new Set(REGIONS)` でフィルタして構築（カテゴリ・検索ページ両方）

### i18n 実装
- `lib/i18n.ts` に翻訳辞書、`useTranslation()` フックで `t()`, `name()`, `gil()` を提供
- locale は cookie (`locale=ja|en`) で保存、`providers.tsx` の `LocaleContext` で配信
- リリースノートは `v1.0.md` (ja) / `v1.0.en.md` (en) のペアで管理
- Server Component では `useTranslation` 使えない → Client Component に分離が必要
- Next.js の `/api` rewrite が Next.js API Route より優先される → フロント内 API Route は使えない

### デプロイ
- GitHub repo: `motte12345/eorzea-market`
- `master` push → GitHub Actions (`.github/workflows/deploy.yml`) → SSH でサーバーの `/opt/eorzea-market/deploy.sh` 実行
- サーバー接続: `ssh ais` （SSH config の Host 名。KNOWLEDGE 旧版の `ais1` は誤記）
- deploy.sh: git pull → pip install → alembic upgrade → atomic frontend build → systemd restart
- フロントビルドは `NEXT_DIST_DIR=.next-new` で別ディレクトリに出力 → 成功後に `mv` で `.next` へ差し替える atomic 方式
- `next.config.ts` で `distDir: process.env.NEXT_DIST_DIR || ".next"` を必ず維持すること（消すとatomicビルドが壊れる）

### Alembic 複数 head 問題（2026-04-28）
- 新しい migration を手書きで作るとき `down_revision` を実際の head 以外（例: 古い空の migration）に設定すると、alembic が "Multiple head revisions are present" で `upgrade head` 拒否
- 確認: `alembic heads` または `from alembic.script import ScriptDirectory; sd.get_heads()`
- 自動生成（`alembic revision --autogenerate`）に任せれば down_revision は自動で正しい head になる
- 手書きで作る場合は必ず現 head を `grep "^revision" alembic/versions/*.py` してから設定する

### 除外アイテム管理（2026-04-28）
- 旧: `update_ranking.py` の `EXCLUDED_ITEM_IDS` Pythonリスト ハードコード → 追加するたびにデプロイ必要
- 新: `excluded_items` テーブル（正式除外）+ `exclusion_requests` テーブル（申請キュー）の2段構成
- 申請: `POST /api/exclusion-requests/{item_id}` でカウンタ式 upsert（同一item_idは row 1つ、重複は count++）
- 承認: `python -m app.collector.apply_exclusions` で pending → excluded_items 昇格 + ランキング再計算
- マイグレーション `7c2a91e4d8b3` で旧ハードコード ID を seed 済み（ダウンタイム無し）
- フロント: ランキング行ボタン → localStorage `eorzea-market-exclusion-requested` で同一ブラウザの重複防止
- 注意: 申請APIは認証無し公開なので、運用が荒れたら CAPTCHA/IP rate limit を追加検討

### サーバー環境（VPS）の制約と対策（2026-04-24）
- RAM 1.9GB / Swap 0 で `next build` が OOM stall → 10分タイムアウトで強制終了 → 旧deploy.shが先に `.next` を削除していたためCSS崩れが発生した
- 対策3点セット:
  1. **Swap 2GB 追加** (`/swapfile`、`/etc/fstab` で永続化)
  2. **deploy.sh atomic化** — `.next-new` にビルド成功後に `mv`。失敗しても稼働中`.next`は無傷
  3. **GitHub Actions `command_timeout: 15m`** （保険、`workflow` スコープが無いとpushでrejectされるのでWeb UI編集）
- 教訓: メモリ少ないVPSでビルドする場合、`NODE_OPTIONS="--max-old-space-size=1536"` でヒープ上限を切る + atomic デプロイは必須
