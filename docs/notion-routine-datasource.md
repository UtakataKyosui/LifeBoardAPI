# Routine 用 Notion データソース（暫定）

`routines/notion/routine.mapper.ts` の `ROUTINE_PROPERTY` と一致させる。実データソースの作成・実接続の検証は #11・#12 で扱い、本書は mapper のテストで確認した仕様のみを述べる。

| プロパティ | Notion 型 | 必須 | 内容 |
| --- | --- | --- | --- |
| Name | title | 必須 | name |
| Routine ID | rich_text | 必須 | UUID。Notion のページ ID とは別に持つ |
| Category | select | 必須 | habit / chore / environment / learning |
| Purpose | rich_text | 任意 | 空なら未設定 |
| Status | select | 必須 | active / archived |
| Schedule Type | select | 必須 | daily |
| Time Zone | rich_text | 必須 | IANA 名 |
| Revision | number | 必須 | 1 以上の整数 |
| Created At / Updated At | date | 必須 | ISO 8601 |
| Target Metric / Target Unit | rich_text | 目標ありのとき必須 | 目標なしなら空 |
| Target Operator | select | 目標ありのとき必須 | gte / lte / eq / between |
| Target Value / Target Min / Target Max | number | operator による | 空は未入力であり 0 ではない |

欠落・不正なプロパティは `RoutineDataInvalidError`（API では 502）になる。
