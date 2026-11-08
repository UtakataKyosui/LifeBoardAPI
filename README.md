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

## CI

`.github/workflows/ci.yml` で、PR と `main` への push ごとに上のコマンドのうち lint・typecheck・test・build を並列に実行する。

- PR では変更されたファイルを見て、必要なジョブだけを実行する。ドキュメントだけの変更ではすべてスキップする。
  - Lint: TypeScript/JavaScript ファイル、oxlint の設定、依存関係、CI 定義の変更
  - Typecheck・Test・Build: `apps/api/**`、依存関係、CI 定義の変更
- `main` への push と手動実行（`workflow_dispatch`）では、全ジョブを実行する。
- action の版は `.github/workflows/actions.lock` で固定する（`uses:` はタグ指定、実行されるコミットはロックファイルが決める）。`uses:` を追加・変更したら `gh actions-lock` を実行してロックファイルを更新する。CI の `Verify actions.lock` が `gh actions-lock --verify` で不一致を検出する。
- pnpm store を `pnpm-lock.yaml` のハッシュをキーにキャッシュする（`.github/actions/setup`）。
- 同じ PR・ブランチで新しい実行が始まると、古い実行はキャンセルされる。
- ブランチ保護の必須チェックには `CI result` だけを指定する。スキップしたジョブは成功として扱う。

## 入力検証と OpenAPI

Zod スキーマを定義元に、`nestjs-zod` の `createZodDto` で DTO を作る。入力は `ZodValidationPipe` で検証し、OpenAPI は `@nestjs/swagger` で同じスキーマから生成する。

## Routine API

API 定義は [apps/api/openapi.yaml](apps/api/openapi.yaml)、判断は [docs/decisions.md](docs/decisions.md)（RT-01〜RT-07）、Notion のプロパティは [docs/notion-routine-datasource.md](docs/notion-routine-datasource.md) を参照。

| メソッド・パス | 内容 |
| --- | --- |
| `POST /routines` | Routine を登録する。Notion が保存を確認した後に 201 を返す |
| `GET /routines` | 保存済み Routine を全ページ取得する |
| `GET /routines/schedule?date=YYYY-MM-DD` | 指定日の実行予定を算出する（省略時は各 Routine のタイムゾーンでの今日） |

既知の制約: Notion の接続設定（下記）が無いと、実行時の保存・取得は「未設定」エラー（502）になる。テストは `NotionRoutineClient` を差し替えて検証している。実 Notion との接続、Workers 上での動作は未検証。Routine の編集・アーカイブ API、毎日以外の周期は対象外。

## 実施記録 API

API 定義は [apps/api/openapi.yaml](apps/api/openapi.yaml)、判断は [docs/decisions.md](docs/decisions.md)（EX-01〜EX-09）、Notion のプロパティは [docs/notion-execution-datasource.md](docs/notion-execution-datasource.md) を参照。

| メソッド・パス | 内容 |
| --- | --- |
| `POST /execution-records` | 1 回の実施を登録する。同日・同 Routine の複数登録、数値なし（measurement 省略）も可 |
| `GET /execution-records?date=YYYY-MM-DD` | 指定日（登録時の Routine のタイムゾーンでの実施日）の記録を全件取得する |
| `GET /execution-records/summary?date=YYYY-MM-DD` | 保存済み記録から実施回数・数値合計・目標達成を導出する |

エラー: 入力不正 400、Routine 不在 404、目標と metric・unit が不一致 422、保存先の失敗・不正データ 502。

既知の制約: Notion API クライアント（#11）が未実装のため、実行時の保存・取得は「未設定」エラー（502）になる。テストは `ExecutionNotionClient` と `NotionRoutineClient` を差し替えて検証している。目標の適用期間（U-02）が未決定のため、目標達成は「その日の合計」で暫定判定する。単位換算、記録の編集・削除、週次以上の集計は対象外。実 Notion との接続、Workers 上での動作は未検証。

## 定期タスクの拡張（Epic #5）

判断は [docs/decisions.md](docs/decisions.md)（RT-08・RT-09・EX-10・AJ-01〜AJ-04）、スキップ・延期の Notion プロパティは [docs/notion-adjustment-datasource.md](docs/notion-adjustment-datasource.md) を参照。

- **曜日指定**: `schedule: { type: "weekly", daysOfWeek: [1,3,5], timeZone }`（月 = 1 … 日 = 7）。`GET /routines/schedule` が該当曜日のみ返す。
- **週N回**: `schedule: { type: "weekly_count", timesPerWeek, timeZone }`。週は月曜始まり、実施日数で判定（同日複数は 1 日）。`GET /execution-records/weekly?date=` で date を含む週を評価する。数値目標の達成とは独立。
- **スキップ・延期**: `POST /occurrence-adjustments/skip`・`/postpone`・`/{id}/cancel`、`GET /occurrence-adjustments?date=`、`GET /occurrence-adjustments/schedule?date=`。実施済みとして数えず、履歴は追記のみ。

既知の制約: 週N回・週の区切り・調整の意味は U-01・U-02 が未決定のため暫定。Outcome 分離案は未承認で採用していない。延期された予定の再延期、確認と保存の間の競合防止は未対応。Notion 実接続・Workers 上の動作は未検証。

## 依存関係のビルドスクリプト

pnpm はビルドスクリプトを持つ依存関係をそのままでは実行しない。許可するパッケージは `pnpm-workspace.yaml` の `allowBuilds` に列挙する（`workerd` は許可、テレメトリ用の `@scarf/scarf` は拒否）。

## 設計判断

[docs/decisions.md](docs/decisions.md) を参照。

## Notion 接続設定

判断は [docs/decisions.md](docs/decisions.md)（NT-01〜NT-03）を参照。Worker の環境変数（トークンはシークレット）で設定する。

| 変数 | 内容 |
| --- | --- |
| `NOTION_TOKEN` | Notion インテグレーションのトークン |
| `NOTION_ROUTINE_DATA_SOURCE_ID` | Routine 用データソース（[仕様](docs/notion-routine-datasource.md)） |
| `NOTION_EXECUTION_DATA_SOURCE_ID` | 実施記録用データソース（[仕様](docs/notion-execution-datasource.md)） |
| `NOTION_ADJUSTMENT_DATA_SOURCE_ID` | スキップ・延期用データソース（[仕様](docs/notion-adjustment-datasource.md)） |

既知の制約: Notion API はモックしたテストでのみ検証しており、実 Notion・Workers 上での接続は未検証。データソース自体（プロパティ作成）は各仕様書に従い手動で用意する。
