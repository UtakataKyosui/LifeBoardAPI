import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.ts";
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
});
