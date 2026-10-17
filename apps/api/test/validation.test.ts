import { Body, Controller, Post } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ZodValidationPipe, createZodDto } from "nestjs-zod";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createOpenApiDocument } from "../src/openapi.ts";
import type { INestApplication } from "@nestjs/common";

class SampleDto extends createZodDto(
	z.object({ title: z.string().min(1), count: z.number().int() }),
) {}

@Controller("sample")
class SampleController {
	@Post()
	create(@Body() body: SampleDto) {
		return body;
	}
}

describe("Zod による入力検証と OpenAPI 定義", () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [SampleController],
			providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
		}).compile();
		app = moduleRef.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("正常な入力を受け付ける", async () => {
		const response = await request(app.getHttpServer())
			.post("/sample")
			.send({ title: "walk", count: 3 });

		expect(response.status).toBe(201);
		expect(response.body).toEqual({ title: "walk", count: 3 });
	});

	it("不正な型を 400 で拒否する", async () => {
		const response = await request(app.getHttpServer())
			.post("/sample")
			.send({ title: "walk", count: "3" });

		expect(response.status).toBe(400);
	});

	it("必須項目の欠落を 400 で拒否する", async () => {
		const response = await request(app.getHttpServer()).post("/sample").send({ count: 3 });

		expect(response.status).toBe(400);
	});

	it("同じスキーマから OpenAPI 定義が生成される", () => {
		const document = createOpenApiDocument(app);

		expect(document.components?.schemas?.SampleDto).toMatchObject({
			type: "object",
			required: ["title", "count"],
			properties: {
				title: { type: "string", minLength: 1 },
				count: { type: "integer" },
			},
		});
		expect(document.paths["/sample"]?.post?.requestBody).toBeDefined();
	});
});
