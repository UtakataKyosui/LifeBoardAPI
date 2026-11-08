import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../src/app.module.ts";
import { createOpenApiDocument } from "../../src/openapi.ts";
import { NotionRoutineClient } from "../../src/routines/notion/notion-routine-client.ts";
import { makeRoutine, page, toNotionPage, validInput } from "./fixtures.ts";
import type { INestApplication } from "@nestjs/common";

const client = { createPage: vi.fn(), queryPages: vi.fn() };

describe("Routine API", () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(NotionRoutineClient)
			.useValue(client)
			.compile();
		app = moduleRef.createNestApplication();
		await app.init();
	});

	beforeEach(() => {
		client.createPage.mockReset();
		client.queryPages.mockReset();
	});

	afterAll(async () => {
		await app.close();
	});

	describe("POST /routines", () => {
		it("有効な Routine を登録し、Notion の確認後に 201 を返す", async () => {
			client.createPage.mockImplementation(async (properties: Record<string, unknown>) => {
				// 保存した内容をそのまま Notion の応答として返す。
				const saved = (properties["Routine ID"] as { rich_text: { text: { content: string } }[] }).rich_text[0]
					?.text.content;
				return toNotionPage(makeRoutine({ id: saved as never }));
			});

			const response = await request(app.getHttpServer()).post("/routines").send(validInput);

			expect(response.status).toBe(201);
			expect(response.body).toMatchObject({ status: "active", revision: 1, name: "ストレッチ" });
			expect(client.createPage).toHaveBeenCalledOnce();
		});

		it("不正入力を 400 で拒否し、Notion を呼ばない", async () => {
			const response = await request(app.getHttpServer())
				.post("/routines")
				.send({ ...validInput, name: "" });

			expect(response.status).toBe(400);
			expect(client.createPage).not.toHaveBeenCalled();
		});

		it("Notion 保存失敗を成功として返さない", async () => {
			client.createPage.mockRejectedValue(new Error("notion down"));

			const response = await request(app.getHttpServer()).post("/routines").send(validInput);

			expect(response.status).toBe(502);
			expect(JSON.stringify(response.body)).not.toContain("notion down");
		});
	});

	describe("GET /routines", () => {
		it("複数ページを結合して返す", async () => {
			const a = makeRoutine({ id: "aaaaaaaa-0000-4000-8000-000000000001" as never });
			const b = makeRoutine({ id: "bbbbbbbb-0000-4000-8000-000000000002" as never });
			client.queryPages
				.mockResolvedValueOnce(page([toNotionPage(a)], "next"))
				.mockResolvedValueOnce(page([toNotionPage(b)]));

			const response = await request(app.getHttpServer()).get("/routines");

			expect(response.status).toBe(200);
			expect(response.body.items.map((r: { id: string }) => r.id)).toEqual([a.id, b.id]);
		});

		it("0 件なら空配列を返す", async () => {
			client.queryPages.mockResolvedValue(page([]));
			const response = await request(app.getHttpServer()).get("/routines");
			expect(response.status).toBe(200);
			expect(response.body).toEqual({ items: [] });
		});

		it("不正な外部データと API 失敗を 502 で返す", async () => {
			client.queryPages.mockResolvedValueOnce(page([{ properties: {} }]));
			expect((await request(app.getHttpServer()).get("/routines")).status).toBe(502);

			client.queryPages.mockRejectedValueOnce(new Error("429"));
			expect((await request(app.getHttpServer()).get("/routines")).status).toBe(502);
		});
	});

	describe("GET /routines/schedule", () => {
		it("指定日の予定を返し、archived は含めない", async () => {
			const active = makeRoutine({ id: "aaaaaaaa-0000-4000-8000-000000000001" as never });
			const archived = makeRoutine({ id: "bbbbbbbb-0000-4000-8000-000000000002" as never, status: "archived" });
			client.queryPages.mockResolvedValue(page([toNotionPage(active), toNotionPage(archived)]));

			const response = await request(app.getHttpServer()).get("/routines/schedule?date=2026-10-19");

			expect(response.status).toBe(200);
			expect(response.body.occurrences).toEqual([
				{ occurrenceKey: `${active.id}:2026-10-19`, routineId: active.id, scheduledDate: "2026-10-19" },
			]);
		});

		it("不正な日付を 400 で拒否する", async () => {
			const response = await request(app.getHttpServer()).get("/routines/schedule?date=2026-02-30");
			expect(response.status).toBe(400);
		});
	});

	it("OpenAPI 定義に Routine のパスが含まれる", () => {
		const document = createOpenApiDocument(app);
		expect(Object.keys(document.paths)).toEqual(
			expect.arrayContaining(["/routines", "/routines/schedule"]),
		);
		expect(document.paths["/routines"]?.post?.requestBody).toBeDefined();
	});
});
