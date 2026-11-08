import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../src/app.module.ts";
import { ExecutionNotionClient } from "../../src/executions/notion/notion-execution-client.ts";
import { createOpenApiDocument } from "../../src/openapi.ts";
import { NotionRoutineClient } from "../../src/routines/notion/notion-routine-client.ts";
import { makeRoutine, page as routinePage, toNotionPage as routineToPage } from "../routines/fixtures.ts";
import { ROUTINE_ID, makeRecord, page, toNotionPage } from "./fixtures.ts";
import type { INestApplication } from "@nestjs/common";

const execClient = { createPage: vi.fn(), queryByLocalDate: vi.fn() };
const routineClient = { createPage: vi.fn(), queryPages: vi.fn() };

const body = { routineId: ROUTINE_ID, performedAt: "2026-10-19T09:30:00+09:00" };
const echoSaved = async (properties: Record<string, { rich_text?: { text: { content: string } }[] }>) => {
	// 送られた内容をそのまま Notion の応答として返す（保存確認）。
	const text = (name: string) => properties[name]?.rich_text?.[0]?.text.content;
	const value = (properties["Measurement Value"] as unknown as { number: number | null }).number;
	const date = (properties["Performed At"] as unknown as { date: { start: string } }).date.start;
	return toNotionPage(
		makeRecord({
			id: text("Record ID") as never,
			performedAt: date,
			localDate: text("Local Date") as never,
			measurement: value === null ? undefined : { metric: text("Measurement Metric")!, value, unit: text("Measurement Unit")! },
		}),
	);
};

describe("実施記録 API", () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(ExecutionNotionClient)
			.useValue(execClient)
			.overrideProvider(NotionRoutineClient)
			.useValue(routineClient)
			.compile();
		app = moduleRef.createNestApplication();
		await app.init();
	});

	beforeEach(() => {
		for (const fn of [...Object.values(execClient), ...Object.values(routineClient)]) fn.mockReset();
		routineClient.queryPages.mockResolvedValue(routinePage([routineToPage(makeRoutine())]));
	});

	afterAll(async () => {
		await app.close();
	});

	describe("POST /execution-records", () => {
		it("数値なしの実施を登録し、保存確認後に 201 を返す。localDate は Routine のタイムゾーンで決まる", async () => {
			execClient.createPage.mockImplementation(echoSaved);
			const response = await request(app.getHttpServer()).post("/execution-records").send(body);

			expect(response.status).toBe(201);
			expect(response.body).toMatchObject({
				routineId: ROUTINE_ID,
				performedAt: "2026-10-19T00:30:00.000Z",
				localDate: "2026-10-19",
			});
			expect(response.body.measurement).toBeUndefined();
		});

		it("UTC 15:00 以降は東京の翌日に属する", async () => {
			execClient.createPage.mockImplementation(echoSaved);
			const response = await request(app.getHttpServer())
				.post("/execution-records")
				.send({ ...body, performedAt: "2026-10-19T15:00:00Z" });
			expect(response.body.localDate).toBe("2026-10-20");
		});

		it("同日・同 Routine への複数登録が別 ID で成功し、数値ゼロも保存できる", async () => {
			execClient.createPage.mockImplementation(echoSaved);
			const measurement = { metric: "duration", value: 0, unit: "min" };
			const first = await request(app.getHttpServer()).post("/execution-records").send({ ...body, measurement });
			const second = await request(app.getHttpServer()).post("/execution-records").send(body);

			expect(first.status).toBe(201);
			expect(first.body.measurement.value).toBe(0);
			expect(second.status).toBe(201);
			expect(second.body.id).not.toBe(first.body.id);
			expect(execClient.createPage).toHaveBeenCalledTimes(2);
		});

		it("不正入力を 400 で拒否し、保存しない", async () => {
			const response = await request(app.getHttpServer()).post("/execution-records").send({ ...body, performedAt: "x" });
			expect(response.status).toBe(400);
			expect(execClient.createPage).not.toHaveBeenCalled();
		});

		it("Routine が存在しなければ 404 で、保存しない", async () => {
			routineClient.queryPages.mockResolvedValue(routinePage([]));
			const response = await request(app.getHttpServer()).post("/execution-records").send(body);
			expect(response.status).toBe(404);
			expect(execClient.createPage).not.toHaveBeenCalled();
		});

		it("目標と metric・unit が異なる measurement を 422 で拒否する", async () => {
			const response = await request(app.getHttpServer())
				.post("/execution-records")
				.send({ ...body, measurement: { metric: "duration", value: 600, unit: "sec" } });
			expect(response.status).toBe(422);
			expect(execClient.createPage).not.toHaveBeenCalled();
		});

		it("保存失敗と Routine 取得失敗を成功として返さず 502 にする", async () => {
			execClient.createPage.mockRejectedValue(new Error("notion down"));
			const failed = await request(app.getHttpServer()).post("/execution-records").send(body);
			expect(failed.status).toBe(502);
			expect(JSON.stringify(failed.body)).not.toContain("notion down");

			routineClient.queryPages.mockRejectedValue(new Error("429"));
			expect((await request(app.getHttpServer()).post("/execution-records").send(body)).status).toBe(502);
		});

		it("保存先の応答が不正なら 502", async () => {
			execClient.createPage.mockResolvedValue({ properties: {} });
			expect((await request(app.getHttpServer()).post("/execution-records").send(body)).status).toBe(502);
		});
	});

	describe("GET /execution-records?date=", () => {
		const a = makeRecord({ id: "aaaaaaaa-0000-4000-8000-000000000001" as never, performedAt: "2026-10-19T03:00:00.000Z" });
		const b = makeRecord({ id: "bbbbbbbb-0000-4000-8000-000000000002" as never, performedAt: "2026-10-19T01:00:00.000Z" });

		it("同日の複数レコードを複数ページにまたがって全件、実施時刻順に返す", async () => {
			execClient.queryByLocalDate
				.mockResolvedValueOnce(page([toNotionPage(a)], "next"))
				.mockResolvedValueOnce(page([toNotionPage(b)]));

			const response = await request(app.getHttpServer()).get("/execution-records?date=2026-10-19");

			expect(response.status).toBe(200);
			expect(response.body.items.map((r: { id: string }) => r.id)).toEqual([b.id, a.id]);
			expect(execClient.queryByLocalDate).toHaveBeenCalledWith("2026-10-19", undefined);
			expect(execClient.queryByLocalDate).toHaveBeenCalledWith("2026-10-19", "next");
		});

		it("保存先が隣接日を返しても混入させない", async () => {
			const next = makeRecord({ id: "cccccccc-0000-4000-8000-000000000003" as never, localDate: "2026-10-20" as never });
			execClient.queryByLocalDate.mockResolvedValue(page([toNotionPage(a), toNotionPage(next)]));
			const response = await request(app.getHttpServer()).get("/execution-records?date=2026-10-19");
			expect(response.body.items.map((r: { id: string }) => r.id)).toEqual([a.id]);
		});

		it("0 件は 200 の空配列、取得失敗は 502 で区別する", async () => {
			execClient.queryByLocalDate.mockResolvedValueOnce(page([]));
			const empty = await request(app.getHttpServer()).get("/execution-records?date=2026-10-19");
			expect(empty.status).toBe(200);
			expect(empty.body).toEqual({ items: [] });

			execClient.queryByLocalDate.mockRejectedValueOnce(new Error("429"));
			expect((await request(app.getHttpServer()).get("/execution-records?date=2026-10-19")).status).toBe(502);

			execClient.queryByLocalDate.mockResolvedValueOnce(page([{ properties: {} }]));
			expect((await request(app.getHttpServer()).get("/execution-records?date=2026-10-19")).status).toBe(502);
		});

		it("date の省略・不正を 400 で拒否する", async () => {
			expect((await request(app.getHttpServer()).get("/execution-records")).status).toBe(400);
			expect((await request(app.getHttpServer()).get("/execution-records?date=2026-02-30")).status).toBe(400);
			expect(execClient.queryByLocalDate).not.toHaveBeenCalled();
		});
	});

	describe("GET /execution-records/summary?date=", () => {
		it("保存済み記録から実施回数・数値合計・目標達成を導出する", async () => {
			execClient.queryByLocalDate.mockResolvedValue(
				page([
					toNotionPage(makeRecord({ id: "aaaaaaaa-0000-4000-8000-000000000001" as never })),
					toNotionPage(makeRecord({ id: "bbbbbbbb-0000-4000-8000-000000000002" as never, measurement: undefined })),
				]),
			);
			const response = await request(app.getHttpServer()).get("/execution-records/summary?date=2026-10-19");

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				date: "2026-10-19",
				summaries: [
					{
						routineId: ROUTINE_ID,
						date: "2026-10-19",
						executionCount: 2,
						executed: true,
						measurements: [{ metric: "duration", unit: "min", count: 1, sum: 10 }],
						targetStatus: "achieved",
					},
				],
			});
		});

		it("記録 0 件の active Routine は executed=false・no_data、取得失敗は 502", async () => {
			execClient.queryByLocalDate.mockResolvedValueOnce(page([]));
			const response = await request(app.getHttpServer()).get("/execution-records/summary?date=2026-10-19");
			expect(response.body.summaries[0]).toMatchObject({ executionCount: 0, executed: false, targetStatus: "no_data" });

			execClient.queryByLocalDate.mockRejectedValueOnce(new Error("x"));
			expect((await request(app.getHttpServer()).get("/execution-records/summary?date=2026-10-19")).status).toBe(502);
		});
	});

	it("OpenAPI 定義に実施記録のパスが含まれる", () => {
		const document = createOpenApiDocument(app);
		expect(Object.keys(document.paths)).toEqual(
			expect.arrayContaining(["/execution-records", "/execution-records/summary"]),
		);
		expect(document.paths["/execution-records"]?.post?.requestBody).toBeDefined();
	});
});
