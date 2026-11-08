# 実施記録用 Notion データソース（暫定）

`executions/notion/execution.mapper.ts` の `EXECUTION_PROPERTY` と一致させる。実データソースの作成・実接続の検証は #11・#12 で扱い、本書は mapper のテストで確認した仕様のみを述べる。Notion に一意制約・トランザクションは無い前提（EX-04）。

| プロパティ | Notion 型 | 必須 | 内容 |
| --- | --- | --- | --- |
| Name | title | 必須 | 表示用（`{localDate} {routineId}`）。読み取りでは使わない |
| Record ID | rich_text | 必須 | UUID。Notion のページ ID とは別に持つ |
| Routine ID | rich_text | 必須 | 対象 Routine の UUID |
| Performed At | date | 必須 | 実施日時（ISO 8601、読み取り時に UTC へ正規化） |
| Local Date | rich_text | 必須 | `YYYY-MM-DD`。日付別取得はこの値で絞り込む |
| Created At | date | 必須 | 登録日時 |
| Measurement Metric / Measurement Unit | rich_text | 数値ありのとき必須 | 数値なしなら空 |
| Measurement Value | number | 数値ありのとき必須 | 空は「数値なし」、0 は「ゼロを入力」 |

欠落・不正・一部だけ入力された Measurement は `ExecutionDataInvalidError`（API では 502）になる。
