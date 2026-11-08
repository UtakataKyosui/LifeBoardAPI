import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdjustmentNotionClient } from "../../src/adjustments/notion/notion-adjustment-client.ts";
import { fromNotionPage, toNotionProperties } from "../../src/adjustments/notion/adjustment.mapper.ts";
import { AppModule } from "../../src/app.module.ts";
import { ExecutionNotionClient } from "../../src/executions/notion/notion-execution-client.ts";
import { createOpenApiDocument } from "../../src/openapi.ts";
import { NotionRoutineClient } from "../../src/routines/notion/notion-routine-client.ts";
import { makeRoutine, page, toNotionPage as routineToPage } from "../routines/fixtures.ts";
import { makeRecord, toNotionPage as recordToPage } from "../executions/fixtures.ts";
import type { INestApplication } from "@nestjs/common";
import type { Adjustment } from "../../src/adjustments/adjustment.schema.ts";

const adjClient = { createPage: vi.fn(), queryPages: vi.fn() };
const routineClient = { createPage: vi.fn(), queryPages: vi.fn() };
const execClient = { createPage: vi.fn(), queryByLocalDate: vi.fn() };

/** Notion が返すページ形状にする。 */
function toPage(adjustment: Adjustment): unknown {
	const props = toNotionProperties(adjustment) as Record<string, Record<string, unknown>>;
	const plain = (value: unknown): unknown =>
		Array.isArray(value)
			? value.map((item) => ({ ...(item as object), plain_text: (item as { text: { content: string } }).text.content }))
			: value;
	return {
		properties: Object.fromEntries(
			Object.entries(props).map(([n, prop]) => [n, Object.fromEntries(Object.entries(prop).map(([k, v]) => [k, plain(v)]))]),
		),
	};
}

const routine = makeRoutine({ schedule: { type: "weekly", daysOfWeek: [1, 3], timeZone: "Asia/Tokyo" } });
const store: Adjustment[] = [];
const ROUTINE_ID = routine.id;

describe("スキップ・延期 API", () => {
	let app: INestApplication;
	const http = () => request(app.getHttpServer());

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(AdjustmentNotionClient)
			.useValue(adjClient)
			.overrideProvider(NotionRoutineClient)
			.useValue(routineClient)
			.overrideProvider(ExecutionNotionClient)
			.useValue(execClient)
			.compile();
		app = moduleRef.createNestApplication();
		await app.init();
	});

	beforeEach(() => {
		store.length = 0;
		for (const fn of [...Object.values(adjClient), ...Object.values(routineClient), ...Object.values(execClient)]) fn.mockReset();
		routineClient.queryPages.mockResolvedValue(page([routineToPage(routine)]));
		// 保存したイベントを後続の取得で返す（追記のみのストア）。
		adjClient.createPage.mockImplementation(async (properties: Record<string, { rich_text?: { text: { content: string } }[]; select?: { name: string }; date?: { start: string } }>) => {
			const text = (name: string) => properties[name]?.rich_text?.[0]?.text.content;
			const saved = fromNotionPage(
				toPage({
					id: text("Adjustment ID") as never,
					kind: properties.Kind?.select?.name as never,
					routineId: text("Routine ID") as never,
					scheduledDate: text("Scheduled Date") as never,
					postponedTo: text("Postponed To") as never,
					cancelsId: text("Cancels ID") as never,
					reason: text("Reason"),
					createdAt: properties["Created At"]?.date?.start as string,
				}),
			);
			store.push(saved);
			return toPage(saved);
		});
		adjClient.queryPages.mockImplementation(async () => page(store.map(toPage)));
	});

	afterAll(async () => {
		await app.close();
	});

	const skip = (scheduledDate: string, extra = {}) => http().post("/occurrence-adjustments/skip").send({ routineId: ROUTINE_ID, scheduledDate, ...extra });
	const postpone = (scheduledDate: string, postponedTo: string) =>
		http().post("/occurrence-adjustments/postpone").send({ routineId: ROUTINE_ID, scheduledDate, postponedTo });

	it("スキップを登録でき、予定は skipped として残る", async () => {
		const response = await skip("2026-10-19", { reason: "体調不良" });
		expect(response.status).toBe(201);
		expect(response.body).toMatchObject({ kind: "skipped", scheduledDate: "2026-10-19", reason: "体調不良" });

		const schedule = await http().get("/occurrence-adjustments/schedule?date=2026-10-19");
		expect(schedule.body.occurrences).toMatchObject([{ status: "skipped", adjustmentId: response.body.id }]);
	});

	it("延期は延期元と延期先の両方から追跡できる", async () => {
		const response = await postpone("2026-10-19", "2026-10-22");
		expect(response.status).toBe(201);
		expect((await http().get("/occurrence-adjustments/schedule?date=2026-10-19")).body.occurrences[0]).toMatchObject({
			status: "postponed",
			postponedTo: "2026-10-22",
		});
		expect((await http().get("/occurrence-adjustments/schedule?date=2026-10-22")).body.occurrences[0]).toMatchObject({
			status: "pending",
			postponedFrom: "2026-10-19",
		});
		expect((await http().get("/occurrence-adjustments?date=2026-10-22")).body.items).toHaveLength(1);
	});

	it("スキップ・延期は実施済みとして数えない", async () => {
		execClient.queryByLocalDate.mockResolvedValue({ results: [], hasMore: false, nextCursor: null });
		await skip("2026-10-19");
		const summary = await http().get("/execution-records/summary?date=2026-10-19");
		expect(summary.status).toBe(200);
		expect(summary.body.summaries.find((s: { routineId: string }) => s.routineId === ROUTINE_ID)).toMatchObject({
			executed: false,
			executionCount: 0,
		});
	});

	it("同じ予定への重複登録は 409（スキップ後の延期も同様）", async () => {
		await skip("2026-10-19");
		expect((await skip("2026-10-19")).status).toBe(409);
		expect((await postpone("2026-10-19", "2026-10-22")).status).toBe(409);
		expect(store).toHaveLength(1);
	});

	it("延期先に予定がある日・別の延期が入った日は 409、過去方向は 422", async () => {
		expect((await postpone("2026-10-19", "2026-10-21")).status).toBe(409); // 水曜は予定日
		await postpone("2026-10-19", "2026-10-22");
		expect((await postpone("2026-10-21", "2026-10-22")).status).toBe(409);
		expect((await postpone("2026-10-21", "2026-10-20")).status).toBe(422);
	});

	it("予定日でない日・週N回・archived・存在しない Routine を拒否する", async () => {
		expect((await skip("2026-10-20")).status).toBe(422);
		expect((await http().post("/occurrence-adjustments/skip").send({ routineId: "99999999-0000-4000-8000-000000000009", scheduledDate: "2026-10-19" })).status).toBe(404);
		routineClient.queryPages.mockResolvedValue(page([routineToPage({ ...routine, status: "archived" })]));
		expect((await skip("2026-10-19")).status).toBe(422);
		routineClient.queryPages.mockResolvedValue(
			page([routineToPage({ ...routine, schedule: { type: "weekly_count", timesPerWeek: 2, timeZone: "Asia/Tokyo" } })]),
		);
		expect((await skip("2026-10-19")).status).toBe(422);
	});

	it("取消は履歴を残したまま予定を pending に戻し、再実行できる", async () => {
		const first = await skip("2026-10-19");
		const cancelled = await http().post(`/occurrence-adjustments/${first.body.id}/cancel`);
		expect(cancelled.status).toBe(201);
		expect(cancelled.body).toMatchObject({ kind: "cancelled", cancelsId: first.body.id });
		expect(store.find((a) => a.id === first.body.id)).toMatchObject({ kind: "skipped" }); // 元の記録は不変

		expect((await http().get("/occurrence-adjustments/schedule?date=2026-10-19")).body.occurrences[0].status).toBe("pending");
		expect((await http().post(`/occurrence-adjustments/${first.body.id}/cancel`)).status).toBe(409);
		expect((await http().post(`/occurrence-adjustments/${cancelled.body.id}/cancel`)).status).toBe(422);
		expect((await postpone("2026-10-19", "2026-10-22")).status).toBe(201); // 取消後は再度調整できる
		expect((await http().get("/occurrence-adjustments")).body.items).toHaveLength(3);
	});

	it("存在しない調整の取消は 404、不正な ID は 400", async () => {
		expect((await http().post("/occurrence-adjustments/99999999-0000-4000-8000-000000000009/cancel")).status).toBe(404);
		expect((await http().post("/occurrence-adjustments/not-a-uuid/cancel")).status).toBe(400);
	});

	it("入力不正は 400、保存失敗は 502 で成功扱いにしない", async () => {
		expect((await http().post("/occurrence-adjustments/postpone").send({ routineId: ROUTINE_ID, scheduledDate: "2026-10-19" })).status).toBe(400);
		expect((await http().get("/occurrence-adjustments/schedule")).status).toBe(400);
		adjClient.createPage.mockRejectedValue(new Error("boom"));
		expect((await skip("2026-10-19")).status).toBe(502);
		adjClient.queryPages.mockRejectedValue(new Error("boom"));
		expect((await http().get("/occurrence-adjustments")).status).toBe(502);
	});

	it("OpenAPI にパスが含まれる", () => {
		const paths = Object.keys(createOpenApiDocument(app).paths ?? {});
		expect(paths).toEqual(
			expect.arrayContaining([
				"/occurrence-adjustments",
				"/occurrence-adjustments/skip",
				"/occurrence-adjustments/postpone",
				"/occurrence-adjustments/{id}/cancel",
				"/occurrence-adjustments/schedule",
				"/execution-records/weekly",
			]),
		);
	});

	it("週N回の週次 API: 週の 7 日分を取得して評価する", async () => {
		routineClient.queryPages.mockResolvedValue(
			page([routineToPage({ ...routine, schedule: { type: "weekly_count", timesPerWeek: 2, timeZone: "Asia/Tokyo" } })]),
		);
		execClient.queryByLocalDate.mockImplementation(async (date: string) =>
			page(date === "2026-10-19" || date === "2026-10-24" ? [recordToPage(makeRecord({ localDate: date as never, id: `aaaaaaaa-0000-4000-8000-0000000000${date.slice(-2)}` as never }))] : []),
		);
		const response = await http().get("/execution-records/weekly?date=2026-10-22");
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ weekStart: "2026-10-19", weekEnd: "2026-10-25" });
		expect(response.body.summaries).toMatchObject([{ required: 2, executedDays: 2, status: "achieved" }]);
		expect(execClient.queryByLocalDate).toHaveBeenCalledTimes(7);
		expect((await http().get("/execution-records/weekly")).status).toBe(400);
	});
});
