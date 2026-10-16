# 設計判断

要件の確定状況は [definite.md](https://github.com/UtakataKyosui/LifeBoardApp/blob/develop/docs/definite.md) に従う。本書は開発基盤に関する判断のみを記録する。状態の区分は definite.md の凡例（決定・暫定・要検証）に合わせる。

| ID | 領域 | 内容 | 状態 | 日付 |
| --- | --- | --- | --- | --- |
| API-01 | 構成 | ワークスペースは `apps/*` のみ。`cf init workers` で作成した Worker に NestJS を組み込み、同一パッケージ `apps/api` に置く。共通パッケージは要件が出るまで作らない。 | 決定（利用者の指示、definite.md D-08・D-09 に沿う） | 2026-10-17 |
| API-02 | lint | oxlint を使い、警告もエラー扱いにする。 | 暫定 | 2026-10-17 |
| API-03 | テスト | vitest と `@nestjs/testing`、supertest を使う。 | 暫定 | 2026-10-17 |
| API-04 | NestJS の実行方式 | `@nestjs/platform-express` の Express アプリを `node:http` の `createServer` に渡して `listen(8080)` し、`cloudflare:node` の `httpServerHandler({ port: 8080 })` を Worker の default export にする。 | 暫定 | 2026-10-17 |
| API-05 | 入力検証と API 定義 | Zod スキーマを単一の定義元とし、`nestjs-zod` の `createZodDto` で DTO にして `ZodValidationPipe`（`APP_PIPE`）で検証する。OpenAPI は `@nestjs/swagger` と `cleanupOpenApiDoc` で同じスキーマから生成し、`GET /openapi.json` で JSON のみ公開する。Swagger UI は配信しない。レスポンスは `@ApiOkResponse` と `@ZodSerializerDto` で定義する。`@asteasolutions/zod-to-openapi` は使わない。 | 暫定 | 2026-10-17 |

## 補足

- API-04 の 8080 は待ち受けポートではなく、リクエストをサーバーへ振り分けるための識別子。
- Worker には `compatibilityFlags: ["nodejs_compat"]` が必要。compatibility date が 2025-09-01 以降なので `node:http` のサーバー機能は自動で有効になる。
- 依存性注入には `emitDecoratorMetadata` が必要なため、`tsconfig.json` で `experimentalDecorators` と `emitDecoratorMetadata` を有効にしている。Vite 8 のビルドと vitest のどちらでもメタデータは出力され、追加のコンパイラは不要だった。

- API-05 の `nestjs-zod@5.5.0` は peer が `@nestjs/common` `^10 || ^11`、`@nestjs/swagger` `^7.4.2 || ^8 || ^11` で、Nest 12 と `@nestjs/swagger@12` は範囲外。`@nestjs/swagger@12` の peer は typescript `^5.5 || ^6` で、TypeScript 7 も範囲外。いずれも `pnpm peers check` で未充足と出るが、下記の範囲では動作した。
- `ZodResponse` は内部で `@nestjs/swagger` を実行時 `require` するため、`cf dev` では解決できず起動に失敗する。代わりに `@ApiOkResponse` と `@ZodSerializerDto` を併用する。
- `@scarf/scarf` はテレメトリ用の postinstall のため `allowBuilds` で拒否している。

## 検証済みの範囲

ローカルの `cf dev` で `GET /health` が 200 を返し、サービスが Controller に注入されることを確認した。`cf build` も成功する。`GET /openapi.json` は Zod スキーマ由来の定義を返す。入力検証は Node 上の vitest で、正常入力の受理、型不正と必須項目欠落の 400 拒否、スキーマからの OpenAPI 生成を確認した。

## 未検証の制約

definite.md の T-01 として #29 で扱う。

- 本番 Workers へのデプロイと動作
- `NestFactory.create` をモジュールのトップレベルで実行しているため、起動時間が Worker の制限に収まるか
- Express バンドルが約 1.8 MB あること
- 追加する依存ライブラリの互換性（`nestjs-zod` と `@nestjs/swagger` は上記の peer 範囲外。Workers 本番での動作は未確認）
- Workers 上で入力検証が 400 を返すこと（Workers に入力を受ける実エンドポイントがまだ無い）
- `pnpm test` は Node 上で動くため、Workers 上の動作を自動で検証するテストは無い
