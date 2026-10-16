# 設計判断

要件の確定状況は [definite.md](https://github.com/UtakataKyosui/LifeBoardApp/blob/develop/docs/definite.md) に従う。本書は開発基盤に関する判断のみを記録する。状態の区分は definite.md の凡例（決定・暫定・要検証）に合わせる。

| ID | 領域 | 内容 | 状態 | 日付 |
| --- | --- | --- | --- | --- |
| API-01 | 構成 | ワークスペースは `apps/*` のみ。`cf init workers` で作成した Worker に NestJS を組み込み、同一パッケージ `apps/api` に置く。共通パッケージは要件が出るまで作らない。 | 決定（利用者の指示、definite.md D-08・D-09 に沿う） | 2026-10-17 |
| API-02 | lint | oxlint を使い、警告もエラー扱いにする。 | 暫定 | 2026-10-17 |
| API-03 | テスト | vitest と `@nestjs/testing`、supertest を使う。 | 暫定 | 2026-10-17 |
| API-04 | NestJS の実行方式 | `@nestjs/platform-express` の Express アプリを `node:http` の `createServer` に渡して `listen(8080)` し、`cloudflare:node` の `httpServerHandler({ port: 8080 })` を Worker の default export にする。 | 暫定 | 2026-10-17 |

## 補足

- API-04 の 8080 は待ち受けポートではなく、リクエストをサーバーへ振り分けるための識別子。
- Worker には `compatibilityFlags: ["nodejs_compat"]` が必要。compatibility date が 2025-09-01 以降なので `node:http` のサーバー機能は自動で有効になる。
- 依存性注入には `emitDecoratorMetadata` が必要なため、`tsconfig.json` で `experimentalDecorators` と `emitDecoratorMetadata` を有効にしている。Vite 8 のビルドと vitest のどちらでもメタデータは出力され、追加のコンパイラは不要だった。

## 検証済みの範囲

ローカルの `cf dev` で `GET /health` が 200 を返し、サービスが Controller に注入されることを確認した。`cf build` も成功する。

## 未検証の制約

definite.md の T-01 として #29 で扱う。

- 本番 Workers へのデプロイと動作
- `NestFactory.create` をモジュールのトップレベルで実行しているため、起動時間が Worker の制限に収まるか
- Express バンドルが約 1.8 MB あること
- 追加する依存ライブラリの互換性
- `pnpm test` は Node 上で動くため、Workers 上の動作を自動で検証するテストは無い
