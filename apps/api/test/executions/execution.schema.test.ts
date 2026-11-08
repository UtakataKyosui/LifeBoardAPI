import { describe, expect, it } from "vitest";
import { ExecutionRecordInputSchema, ExecutionRecordSchema } from "../../src/executions/execution.schema.ts";
import { fromNotionPage, toNotionProperties } from "../../src/executions/notion/execution.mapper.ts";
import { ROUTINE_ID, makeRecord, toNotionPage } from "./fixtures.ts";

const input = { routineId: ROUTINE_ID, performedAt: "2026-10-19T09:30:00+09:00" };

describe("ExecutionRecordInputSchema", () => {
	it("measurement なしの実施を表現できる", () => {
		expect(ExecutionRecordInputSchema.safeParse(input).success).toBe(true);
	});

	it("数値ゼロを有効な値として受け付け、未入力（省略）と区別する", () => {
		const zero = ExecutionRecordInputSchema.parse({ ...input, measurement: { metric: "duration", value: 0, unit: "min" } });
		const none = ExecutionRecordInputSchema.parse(input);
		expect(zero.measurement?.value).toBe(0);
		expect(none.measurement).toBeUndefined();
	});

	it.each([
		["routineId が UUID でない", { ...input, routineId: "x" }],
		["performedAt が日時でない", { ...input, performedAt: "2026-10-19" }],
		["performedAt を省略", { routineId: ROUTINE_ID }],
		["value が NaN 相当（文字列）", { ...input, measurement: { metric: "m", value: "1", unit: "min" } }],
		["value を省略した measurement", { ...input, measurement: { metric: "m", unit: "min" } }],
		["unit が空", { ...input, measurement: { metric: "m", value: 1, unit: " " } }],
		["metric が空", { ...input, measurement: { metric: "", value: 1, unit: "min" } }],
	])("不正入力を拒否する: %s", (_name, value) => {
		expect(ExecutionRecordInputSchema.safeParse(value).success).toBe(false);
	});

	it("無限大の value を拒否する", () => {
		const result = ExecutionRecordInputSchema.safeParse({ ...input, measurement: { metric: "m", value: Infinity, unit: "u" } });
		expect(result.success).toBe(false);
	});
});

describe("ExecutionRecordSchema", () => {
	it("同日・同 Routine の複数レコードを許容する（一意制約を持たない）", () => {
		const a = makeRecord();
		const b = makeRecord({ id: "22222222-0000-4000-8000-000000000002" as never });
		expect(ExecutionRecordSchema.safeParse(a).success && ExecutionRecordSchema.safeParse(b).success).toBe(true);
		expect(a.routineId).toBe(b.routineId);
		expect(a.localDate).toBe(b.localDate);
	});
});

describe("Notion mapper", () => {
	it("measurement ありを往復できる", () => {
		const record = makeRecord();
		expect(fromNotionPage(toNotionPage(record))).toEqual(record);
	});

	it("数値なしと数値ゼロを区別して往復する", () => {
		const none = makeRecord({ measurement: undefined });
		const zero = makeRecord({ measurement: { metric: "duration", value: 0, unit: "min" } });
		expect(fromNotionPage(toNotionPage(none)).measurement).toBeUndefined();
		expect(fromNotionPage(toNotionPage(zero)).measurement?.value).toBe(0);
		expect((toNotionProperties(none)["Measurement Value"] as { number: unknown }).number).toBeNull();
	});

	it("一部だけ入力された measurement を拒否する", () => {
		const page = toNotionPage(makeRecord({ measurement: undefined })) as {
			properties: Record<string, { rich_text?: unknown[] }>;
		};
		page.properties["Measurement Unit"] = { rich_text: [{ plain_text: "min" }] };
		expect(() => fromNotionPage(page)).toThrow();
	});

	it("UTC オフセット付きの日時を UTC に揃える", () => {
		const page = toNotionPage(makeRecord()) as { properties: Record<string, { date?: { start: string } }> };
		page.properties["Performed At"] = { date: { start: "2026-10-19T09:30:00.000+09:00" } };
		expect(fromNotionPage(page).performedAt).toBe("2026-10-19T00:30:00.000Z");
	});
});
