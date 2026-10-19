import { describe, expect, it } from "vitest";
import { LocalDateSchema, RoutineInputSchema, TargetSchema } from "../../src/routines/routine.schema.ts";
import { validInput } from "./fixtures.ts";

describe("RoutineInputSchema", () => {
	it("正常なデータを受け付ける", () => {
		expect(RoutineInputSchema.parse(validInput)).toMatchObject({ name: "ストレッチ" });
	});

	it("目標と purpose は省略できる", () => {
		const { target: _t, purpose: _p, ...minimal } = validInput;
		expect(RoutineInputSchema.safeParse(minimal).success).toBe(true);
	});

	it.each([
		["空の名前", { ...validInput, name: "  " }],
		["未定義のカテゴリ", { ...validInput, category: "todo" }],
		["未対応の周期", { ...validInput, schedule: { type: "weekly", timeZone: "Asia/Tokyo" } }],
		["不正なタイムゾーン", { ...validInput, schedule: { type: "daily", timeZone: "Mars/Base" } }],
		["必須項目の欠落", { category: "habit", schedule: validInput.schedule }],
	])("%s を拒否する", (_label, input) => {
		expect(RoutineInputSchema.safeParse(input).success).toBe(false);
	});
});

describe("TargetSchema", () => {
	const base = { metric: "steps", unit: "count" };

	it("between は min と max を要求し、min > max を拒否する", () => {
		expect(TargetSchema.safeParse({ ...base, operator: "between", min: 1, max: 5 }).success).toBe(true);
		expect(TargetSchema.safeParse({ ...base, operator: "between", min: 1 }).success).toBe(false);
		expect(TargetSchema.safeParse({ ...base, operator: "between", min: 6, max: 5 }).success).toBe(false);
	});

	it("between 以外は value を要求する", () => {
		expect(TargetSchema.safeParse({ ...base, operator: "gte", value: 0 }).success).toBe(true);
		expect(TargetSchema.safeParse({ ...base, operator: "gte" }).success).toBe(false);
		expect(TargetSchema.safeParse({ ...base, operator: "eq", value: 1, min: 0 }).success).toBe(false);
	});
});

describe("LocalDateSchema", () => {
	it("実在する日付のみ受け付ける", () => {
		expect(LocalDateSchema.safeParse("2028-02-29").success).toBe(true);
		expect(LocalDateSchema.safeParse("2027-02-29").success).toBe(false);
		expect(LocalDateSchema.safeParse("2026-1-1").success).toBe(false);
	});
});
