# fanzine-generator

同人誌のレイアウトを自動作成するアプリケーション

## 開発

`npm install` で依存関係を取得し、`npm run dev` で開発サーバーを起動します。

## コードチェック・整形

- `npm run lint` — JavaScript・TypeScript・Vueのエラーを検査
- `npm run lint:fix` — ESLintで自動修正可能な問題を修正
- `npm run typecheck` — TypeScript・Vueの型を検査
- `npm run format` — Prettierでコードを整形
- `npm run format:check` — 整形済みか検査（ファイル変更なし）
- `npm run build` — 本番ビルド

ESLintはJavaScriptの推奨ルールとVueの必須ルールを使用し、TypeScriptとVueは`vue-tsc`で型を検査します。整形はPrettierが担当します。

Prettierはセミコロンなし・シングルクォートで、それ以外は標準設定です。
