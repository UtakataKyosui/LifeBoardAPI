---
paths:
  - "apps/api/**"
---

# API 定義を先に書く

エンドポイントを追加・変更するときは、ビジネスロジックより先に API 定義を確定する。

1. OpenAPI の YAML（`apps/api/openapi.yaml`）に、パス・メソッド・リクエスト・レスポンス・エラーを書く。
2. 同じ内容を Zod スキーマに書き、`createZodDto` で DTO にする。YAML と Zod スキーマは同じ変更で一緒に編集し、食い違いを残さない。
3. Controller に DTO を結び付け、検証と OpenAPI 定義が効くことをテストで確認する。
4. 1〜3 が済んでから Service などのビジネスロジックを実装する。

- 未決定の仕様は、実装前に `docs/decisions.md` に決定を記録する。
- 検証は `ZodValidationPipe` に任せ、Service 内で入力を再検証しない。
