# 設計判断

要件の確定状況は [definite.md](https://github.com/UtakataKyosui/LifeBoardApp/blob/develop/docs/definite.md) に従う。本書は開発基盤に関する判断のみを記録する。状態の区分は definite.md の凡例（決定・暫定・要検証）に合わせる。

| ID | 領域 | 内容 | 状態 | 日付 |
| --- | --- | --- | --- | --- |
| API-01 | 構成 | ワークスペースは `apps/*` のみ。`cf init workers` で作成した Worker に NestJS を組み込み、同一パッケージ `apps/api` に置く。共通パッケージは要件が出るまで作らない。 | 決定（利用者の指示、definite.md D-08・D-09 に沿う） | 2026-10-17 |
| API-02 | lint | oxlint を使い、警告もエラー扱いにする。 | 暫定 | 2026-10-17 |
| API-03 | テスト | vitest と `@nestjs/testing`、supertest を使う。 | 暫定 | 2026-10-17 |
| API-04 | NestJS の実行方式 | `@nestjs/platform-express` の Express アプリを `node:http` の `createServer` に渡して `listen(8080)` し、`cloudflare:node` の `httpServerHandler({ port: 8080 })` を Worker の default export にする。 | 暫定 | 2026-10-17 |
| API-05 | 入力検証と API 定義 | Zod スキーマを単一の定義元とし、`nestjs-zod` の `createZodDto` で DTO にして `ZodValidationPipe`（`APP_PIPE`）で検証する。OpenAPI は `@nestjs/swagger` と `cleanupOpenApiDoc` で同じスキーマから生成し、`GET /openapi.json` で JSON のみ公開する。Swagger UI は配信しない。レスポンスは `@ApiOkResponse` と `@ZodSerializerDto` で定義する。`@asteasolutions/zod-to-openapi` は使わない。 | 暫定 | 2026-10-17 |
| RT-01 | Routine スキーマ | Routine は id（UUID）・name・category（habit/chore/environment/learning、definite.md D-02 の4領域）・purpose（任意）・status（active/archived）・schedule・target（任意）・revision・createdAt・updatedAt を持つ。ドメイン（`routines/routine.schema.ts`）は Zod のみに依存し、NestJS・Notion・AI を参照しない。id・status・revision・日時はサーバーが決め、登録入力には含めない。 | 暫定 | 2026-10-19 |
| RT-02 | ScheduleRule | MVP は `{ type: "daily", timeZone }` のみ。timeZone は IANA 名で、日付境界の評価に使う。曜日指定・週N回は U-01 が未決定のため実装しない。 | 暫定（3方式は暫定採用案） | 2026-10-19 |
| RT-03 | Target | 0〜1 件。operator は gte/lte/eq/between。between は min・max 必須（min ≤ max）、それ以外は value 必須。複数目標・適用期間は U-02 が未決定のため扱わない。数値の未入力をゼロにしない。 | 暫定 | 2026-10-19 |
| RT-04 | 履歴 | revision を持つが、更新・版管理（U-06）は未実装。Routine の編集 API は本 Epic の範囲外。 | 未決定（U-06） | 2026-10-19 |
| RT-05 | Repository | `RoutineRepository`（抽象クラス、save/listAll）を Service が使い、Notion は `NotionRoutineRepository` に隔離する（T-12）。Notion API クライアント（#11）は未実装のため、`NotionRoutineClient` を DI の境界とし、既定では「未設定」で常に失敗する。 | 暫定 | 2026-10-19 |
| RT-06 | 失敗の扱い | Notion の通信失敗・レート制限・応答検証失敗はすべて 502 を返し、保存成功として返さない。一覧は一部ページが不正でも欠落させず全体を失敗にする。ログには種別と不正なプロパティ名のみ出し、内容・トークンは出さない。 | 暫定 | 2026-10-19 |
| RT-07 | 実行予定 | `GET /routines/schedule?date=YYYY-MM-DD`。active な Routine ごとに 1 件の Occurrence（occurrenceKey = `{routineId}:{date}`）を返す。date 省略時は各 Routine の timeZone での今日。LLM は使わず、純関数（`routines/occurrence.ts`）で算出する。 | 暫定 | 2026-10-19 |
| EX-01 | ExecutionRecord スキーマ | 1 レコード = 1 回の実施。id（UUID）・routineId・performedAt（UTC）・localDate・measurement（任意）・createdAt を持つ。同日・同 Routine の複数レコードを許容し、一意制約を持たない。id・localDate・createdAt はサーバーが決める。ドメイン（`executions/execution.schema.ts`）は Zod のみに依存する。 | 暫定 | 2026-11-08 |
| EX-02 | Measurement | `{ metric, value, unit }` を丸ごと任意とする。省略は「数値なし」、`value: 0` は「ゼロを入力」で別物。value は有限数。単位換算はしない。Routine に目標がある場合、metric・unit が目標と一致しなければ 422。目標が無い Routine は任意の metric・unit を受け付ける。 | 暫定 | 2026-11-08 |
| EX-03 | 実施日（localDate） | 登録時に performedAt を Routine の `schedule.timeZone` で評価した `YYYY-MM-DD` を保存する。後から Routine の timeZone を変えても過去の記録の日付は動かない。日付別取得は localDate の一致で行い、隣接日は保存先が返しても取り除く。 | 暫定 | 2026-11-08 |
| EX-04 | 登録の前提 | Notion の一意制約・トランザクションに依存しない。Routine の存在は保存前に確認するだけで、確認と保存の間の競合は防がない。存在しなければ 404。archived の Routine への記録は拒否しない（実施の事実を優先）。performedAt が未来でも拒否しない。 | 暫定 | 2026-11-08 |
| EX-05 | 失敗の扱い | 保存先・Routine の通信失敗、応答の検証失敗は 502。保存成功として返さない。0 件は 200 の空配列で取得失敗と区別する。ログには種別と不正プロパティ名のみ出す（RT-06 と同じ）。 | 暫定 | 2026-11-08 |
| EX-06 | 日次集計 | `GET /execution-records/summary?date=`。保存済み記録から純関数（`executions/summary.ts`）で導出し、集計結果は保存しない。executionCount（記録件数）と measurements（metric・unit ごとの count・sum、数値なしは含めない）を別々に出す。 | 暫定 | 2026-11-08 |
| EX-07 | 目標達成の評価 | 実施有無（`executed`）と目標達成（`targetStatus`）を分離する。目標と同じ metric・unit の合計に対し operator で判定し、achieved / not_achieved。対応する数値が 1 件も無ければ no_data（未達でもゼロでもない）、目標なしは no_target。**目標の適用期間は U-02 が未決定のため、暫定で「その日の合計」とする。** 週単位などは扱わない。合計と目標値は小数 9 桁に丸めて比較し、浮動小数点の加算誤差（0.1 + 0.2 など）で判定を変えない。 | 暫定（U-02 未決定） | 2026-11-08 |
| EX-08 | 日付指定 | 日付別取得・集計は `date` を必須とする。Routine ごとにタイムゾーンが異なるため「今日」を一意に決められない。 | 暫定 | 2026-11-08 |
| EX-09 | Repository | `ExecutionRepository`（save/listByLocalDate）を Service が使い、Notion は `NotionExecutionRepository` に隔離する。Notion API クライアント（#11）は未実装のため `ExecutionNotionClient` を DI の境界とし、既定は「未設定」で常に失敗する。Routine の存在確認・集計用の取得は `RoutineRepository.listAll` を使う（Routine 数が少ない MVP 前提。増えたら ID 検索を追加する）。 | 暫定 | 2026-11-08 |
| RT-08 | 曜日指定（#22） | ScheduleRule に `{ type: "weekly", daysOfWeek, timeZone }` を追加する。daysOfWeek は ISO 曜日番号（月 = 1 … 日 = 7）の昇順・重複なし・1〜7 件（表現を一意にするため）。曜日は「Routine のタイムゾーンでのローカル日付」の曜日で判定する。日付文字列からの曜日算出は UTC 0 時で行い、タイムゾーン・夏時間に依存しない（日付境界の変換は `localDateOf` が担う）。`isScheduledOn` / `occurrencesOn` は決定的な純関数。RT-02 の「U-01 未決定」は、利用者の指示（Epic #5）により曜日指定・週N回を実装対象としたが、**方式の確定ではなく暫定**。 | 暫定（U-01） | 2026-11-08 |
| RT-09 | 週N回の周期（#23） | `{ type: "weekly_count", timesPerWeek: 1〜7, timeZone }` を追加する。曜日は決めないため特定日の予定（Occurrence）は持たず、`/routines/schedule` にも出さない。 | 暫定（U-01） | 2026-11-08 |
| EX-10 | 週の区切り・週N回の意味（#23） | 週は **月曜始まり（ISO 8601）**。「週N回」は **実施日数**（1 件以上の実施がある日の数）が N 以上で達成。同日に複数回実施しても 1 日と数える（回数は `executionCount` として参考値で返すが判定に使わない）。週への振り分けは記録の `localDate`（EX-03）で行うため、タイムゾーンは登録時の Routine のものに固定される。評価は実施の事実のみで、数値目標（EX-07）とは独立（数値が未達でも週N回は達成になり得る）。週の途中の状態は `not_achieved` として返し、「進行中」は区別しない（週が終わったかの判断は呼び出し側）。`GET /execution-records/weekly?date=` は date を含む週を評価し、Local Date が文字列で範囲検索できないため日ごとに最大 7 回取得する。 | 暫定（U-01、U-02） | 2026-11-08 |
| AJ-01 | 状態の意味（#24） | 「未実施」= 予定日に実施記録が無い状態（記録からの導出で、保存しない）。「スキップ」= 予定を行わないと決めた事実、「延期」= 予定を別の日へ移した事実、「取消」= スキップ・延期を無かったことにする操作。いずれも**実施記録（ExecutionRecord）を作らず、実施済みとして数えない**（日次集計・週次評価に影響しない）。 | 暫定 | 2026-11-08 |
| AJ-02 | 追記のみの履歴 | 調整は `skipped` / `postponed` / `cancelled` の追記のみのイベントで、更新・削除をしない。取消は `cancelled`（`cancelsId` で対象を指す）を追記し、元のイベントは変更しない。有効な調整 = 取り消されていない skipped / postponed。取消後は同じ予定を再度スキップ・延期できる。Notion には createPage のみで足りる。 | 暫定 | 2026-11-08 |
| AJ-03 | 元の予定と延期先の関連・重複防止 | 調整は元の予定日（`scheduledDate`）と延期先（`postponedTo`）の両方を持ち、`/occurrence-adjustments/schedule` は延期元に `postponed`、延期先に `postponedFrom` 付きの予定を返す。対象にできるのは周期上の予定日のみ（それ以外・archived・週N回は 422）。同じ予定に有効な調整が複数ある（409）、延期先に周期上の予定がある（409）、同じ日へ別の延期が入る（409）、延期先が元の日以前（422）は拒否する。延期された予定自体の再延期は未対応（取り消して元の予定から延期し直す）。確認と保存の間の競合は Notion に一意制約が無いため防げない。 | 暫定 | 2026-11-08 |
| AJ-04 | Outcome 分離案 | 実施結果（Outcome）を実施記録から分離して「実施・スキップ・延期」を 1 つの状態で扱う案は**未承認のため採用しない**。本実装は実施記録（ExecutionRecord）と調整（Adjustment）を別エンティティとして保ち、将来 Outcome 案が承認された場合は両者の統合を再検討する。 | 未決定 | 2026-11-08 |

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
