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
- サーバー接続: `ssh ais1`
- deploy.sh: git pull → pip install → alembic upgrade → npm build → systemd restart
