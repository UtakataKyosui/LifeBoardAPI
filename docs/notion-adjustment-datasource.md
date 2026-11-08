# スキップ・延期用 Notion データソース（暫定）

`adjustments/notion/adjustment.mapper.ts` の `ADJUSTMENT_PROPERTY` と一致させる。追記のみ（更新・削除しない、AJ-02）。実データソースの作成・実接続の検証は #11・#12 で扱う。

| プロパティ | Notion 型 | 必須 | 内容 |
| --- | --- | --- | --- |
| Name | title | 必須 | 表示用 |
| Adjustment ID | rich_text | 必須 | UUID |
| Kind | select | 必須 | skipped / postponed / cancelled |
| Routine ID | rich_text | 必須 | UUID |
| Scheduled Date | rich_text | 必須 | 元の予定日 YYYY-MM-DD |
| Postponed To | rich_text | postponed のとき必須 | 延期先 YYYY-MM-DD。他では空 |
| Cancels ID | rich_text | cancelled のとき必須 | 取り消す調整の Adjustment ID。他では空 |
| Reason | rich_text | 任意 | 理由 |
| Created At | date | 必須 | ISO 8601 |

欠落・不正なプロパティは `AdjustmentDataInvalidError`（API では 502）になる。
