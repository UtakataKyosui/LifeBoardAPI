import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.ts";
import { createOpenApiDocument } from "../src/openapi.ts";
import type { INestApplication } from "@nestjs/common";

describe("GET /health", () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();
		app = moduleRef.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("HealthService を注入した Controller が status ok を返す", async () => {
		const response = await request(app.getHttpServer()).get("/health");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ status: "ok" });
	});

	it("OpenAPI のレスポンスは出力スキーマで未定義の項目を許可しない", () => {
		const document = createOpenApiDocument(app);
		const schemas = document.components?.schemas ?? {};

		expect(schemas.HealthResponseDto_Output).toMatchObject({
			type: "object",
			required: ["status"],
			additionalProperties: false,
		});
	});
});
