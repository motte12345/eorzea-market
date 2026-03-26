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
