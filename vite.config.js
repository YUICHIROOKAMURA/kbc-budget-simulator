# 就職後の収支シミュレーター（家計ノート）

就労移行支援の利用者が、就職後の収入・支出・貯金/投資計画・目標達成の見込みをシミュレーションできる Web アプリです。

- ログイン機能なし。入力内容は各自の**ブラウザ内（localStorage）**に保存されます
- 「この内容を保存」を押すとその端末・ブラウザに保存され、次回開いた時に呼び出されます
- 端末やブラウザを変えるとデータは引き継がれません（サーバー保存ではないため）

## ローカルで動かす

```bash
npm install
npm run dev
```

`http://localhost:5173` で確認できます。

## 本番公開（Vercel + GitHub）

kbc-library と同じ流れです。

1. このフォルダを GitHub の新しいリポジトリにプッシュ
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/（自分のアカウント）/kbc-budget-simulator.git
   git push -u origin main
   ```
2. [vercel.com](https://vercel.com) にログイン → 「Add New Project」→ 上記リポジトリを選択
3. Framework Preset は自動で "Vite" と認識されるはずです（されない場合は手動で選択）
4. Build Command: `npm run build` / Output Directory: `dist`（Viteの場合は通常自動設定）
5. 「Deploy」を押すと数分で公開URLが発行されます

環境変数やバックエンドの設定は不要です（完全に静的なアプリのため）。

## 今後ログイン機能や複数端末での同期が必要になったら

その際は Supabase 等を使ったデータ保存に切り替える必要があります（kbc-library のような構成）。声をかけてください。
