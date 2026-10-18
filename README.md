# 同人誌レイアウトジェネレーター

画像を配置して同人誌のページを PNG で作成する、Vue と Vite の静的アプリです。画像の読み込み・編集・書き出しはブラウザー内で完結し、画像をサーバーへ送信しません。サーバーや API キーは不要です。

## 開発

Node.js 24 と npm を使用します。

```sh
npm ci
npm run dev
```

`npm run lint` でコードを検査し、`npm run build` で型検査と本番ビルドを行います。生成物は `dist/` です。`npm run preview` で生成物をローカル確認できます。

## GitHub Pages

リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。`main` ブランチへの push、または Actions 画面からの手動実行で、`.github/workflows/deploy-pages.yml` が `dist/` をビルドして公開します。公開先は `https://motttey.github.io/fanzine-generator/` です。

Vite は相対パスでアセットを生成するため、リポジトリ配下の URL でも配信できます。

## Cloudflare Pages

Git リポジトリを Pages に接続し、次の設定を指定します。

| 設定                   | 値                 |
| ---------------------- | ------------------ |
| Framework preset       | Vue または None    |
| Production branch      | `main`             |
| Build command          | `npm run build`    |
| Build output directory | `dist`             |
| Root directory         | リポジトリのルート |

`.nvmrc` で Node.js 24 を指定しています。`public/_headers` はビルド時に `dist/` へコピーされ、Cloudflare Pages でセキュリティヘッダーとハッシュ付きアセットの長期キャッシュを設定します。GitHub Pages は `_headers` に対応しません。

## 公開時の動作

- 対応画像は JPG・PNG・WebP、30 MB 以下、3000 万画素以下です。SVG は読み込みません。
- PNG は端末側で生成します。大きな画像や 300 DPI の書き出しには端末のメモリが必要です。失敗した場合は 150 DPI を試せます。
- Google Fonts から Noto Sans JP を読み込みます。画像データは送信しませんが、フォント取得の通信は発生します。
- URL に編集状態や画像は保存されません。ページを再読み込みすると編集内容は消えます。

## その他のコマンド

- `npm run lint:fix` — ESLint の自動修正
- `npm run typecheck` — TypeScript・Vue の型検査
- `npm run format` — Prettier による整形
- `npm run format:check` — 整形の検査
