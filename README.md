# LifeBoard API

LifeBoard の API を開発する pnpm workspace。

## 構成

| パス | 内容 |
| --- | --- |
| `apps/api` (`@lifeboard/api`) | Cloudflare Workers 上で動く NestJS アプリケーション |

## 前提

- Node.js 22 以上
- pnpm 12（`packageManager` で固定）

## コマンド

ルートで実行する。

| コマンド | 内容 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 依存関係のインストール |
| `pnpm lint` | oxlint による静的解析（警告もエラー扱い） |
| `pnpm typecheck` | `cf workers types` で型を生成し `tsc`（strict）を実行 |
| `pnpm test` | vitest による全パッケージのテスト |
| `pnpm build` | 全パッケージのビルド |
| `pnpm dev` | `cf dev` でローカル起動（`http://localhost:5173/health`、OpenAPI 定義は `/openapi.json`） |

## 入力検証と OpenAPI

Zod スキーマを定義元に、`nestjs-zod` の `createZodDto` で DTO を作る。入力は `ZodValidationPipe` で検証し、OpenAPI は `@nestjs/swagger` で同じスキーマから生成する。

## Routine API

API 定義は [apps/api/openapi.yaml](apps/api/openapi.yaml)、判断は [docs/decisions.md](docs/decisions.md)（RT-01〜RT-07）、Notion のプロパティは [docs/notion-routine-datasource.md](docs/notion-routine-datasource.md) を参照。

| メソッド・パス | 内容 |
| --- | --- |
| `POST /routines` | Routine を登録する。Notion が保存を確認した後に 201 を返す |
| `GET /routines` | 保存済み Routine を全ページ取得する |
| `GET /routines/schedule?date=YYYY-MM-DD` | 指定日の実行予定を算出する（省略時は各 Routine のタイムゾーンでの今日） |

既知の制約: Notion API クライアント（#11）が未実装のため、実行時の保存・取得は「未設定」エラー（502）になる。テストは `NotionRoutineClient` を差し替えて検証している。実 Notion との接続、Workers 上での動作は未検証。Routine の編集・アーカイブ API、毎日以外の周期は対象外。

## 依存関係のビルドスクリプト

pnpm はビルドスクリプトを持つ依存関係をそのままでは実行しない。許可するパッケージは `pnpm-workspace.yaml` の `allowBuilds` に列挙する（`workerd` は許可、テレメトリ用の `@scarf/scarf` は拒否）。

## 設計判断

[docs/decisions.md](docs/decisions.md) を参照。
