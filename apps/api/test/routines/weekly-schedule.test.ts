import { describe, expect, it } from "vitest";
import { addDays, isoWeekdayOf, weekRangeOf } from "../../src/routines/calendar.ts";
import { occurrencesOn } from "../../src/routines/occurrence.ts";
import { fromNotionPage } from "../../src/routines/notion/routine.mapper.ts";
import { LocalDateSchema, RoutineInputSchema } from "../../src/routines/routine.schema.ts";
import { makeRoutine, toNotionPage, validInput } from "./fixtures.ts";

const d = (value: string) => LocalDateSchema.parse(value);
const weekly = (daysOfWeek: number[], timeZone = "Asia/Tokyo") =>
	makeRoutine({ schedule: { type: "weekly", daysOfWeek, timeZone } as never });

describe("カレンダー計算", () => {
	it("曜日は月曜 = 1、日曜 = 7", () => {
		expect(isoWeekdayOf(d("2026-10-19"))).toBe(1); // 月
		expect(isoWeekdayOf(d("2026-10-25"))).toBe(7); // 日
	});

	it("週は月曜始まりで、週・月・年の境界をまたいで算出する", () => {
		expect(weekRangeOf(d("2026-10-25"))).toEqual({ weekStart: "2026-10-19", weekEnd: "2026-10-25" });
		expect(weekRangeOf(d("2026-10-26"))).toEqual({ weekStart: "2026-10-26", weekEnd: "2026-11-01" });
		expect(weekRangeOf(d("2026-01-01"))).toEqual({ weekStart: "2025-12-29", weekEnd: "2026-01-04" });
	});

	it("夏時間の切り替え日を含む加算でも日付がずれない", () => {
		expect(addDays(d("2026-10-31"), 2)).toBe("2026-11-02");
		expect(addDays(d("2026-03-01"), -1)).toBe("2026-02-28");
	});
});

describe("曜日指定の予定算出", () => {
	it("指定曜日だけ予定になる（月・水・金）", () => {
		const routine = weekly([1, 3, 5]);
		const on = (date: string) => occurrencesOn([routine], { date: d(date) }).length;
		expect([on("2026-10-19"), on("2026-10-20"), on("2026-10-21"), on("2026-10-23"), on("2026-10-25")]).toEqual([1, 0, 1, 1, 0]);
	});

	it("now 指定では Routine のタイムゾーンで曜日を判定する", () => {
		// UTC 2026-10-18(日) 20:00 → 東京は 10/19(月) 05:00、ニューヨークは 10/18(日) 16:00
		const now = new Date("2026-10-18T20:00:00Z");
		const tokyo = weekly([1]);
		const newYork = makeRoutine({
			id: "bbbbbbbb-0000-4000-8000-000000000002" as never,
			schedule: { type: "weekly", daysOfWeek: [1], timeZone: "America/New_York" },
		});
		const result = occurrencesOn([tokyo, newYork], { now });
		expect(result.map((o) => o.routineId)).toEqual([tokyo.id]);
	});

	it("週N回は特定日の予定を持たない", () => {
		const routine = makeRoutine({ schedule: { type: "weekly_count", timesPerWeek: 3, timeZone: "Asia/Tokyo" } });
		expect(occurrencesOn([routine], { date: d("2026-10-19") })).toEqual([]);
	});

	it("同じ入力から同じ結果を返す", () => {
		const routines = [weekly([2, 4]), weekly([1, 2])];
		expect(occurrencesOn(routines, { date: d("2026-10-20") })).toEqual(occurrencesOn(routines, { date: d("2026-10-20") }));
	});
});

describe("周期スキーマ", () => {
	const parse = (schedule: unknown) => RoutineInputSchema.safeParse({ ...validInput, schedule }).success;
	it("曜日指定は 1〜7 の昇順・重複なしのみ受け付ける", () => {
		expect(parse({ type: "weekly", daysOfWeek: [1, 3, 7], timeZone: "Asia/Tokyo" })).toBe(true);
		for (const days of [[], [0], [8], [3, 1], [1, 1], [1.5]]) {
			expect(parse({ type: "weekly", daysOfWeek: days, timeZone: "Asia/Tokyo" })).toBe(false);
		}
	});
	it("週N回は 1〜7 の整数のみ受け付ける", () => {
		expect(parse({ type: "weekly_count", timesPerWeek: 3, timeZone: "Asia/Tokyo" })).toBe(true);
		for (const n of [0, 8, 2.5]) expect(parse({ type: "weekly_count", timesPerWeek: n, timeZone: "Asia/Tokyo" })).toBe(false);
	});
});

describe("Notion 変換", () => {
	it("曜日指定・週N回が往復しても変わらない", () => {
		for (const routine of [weekly([1, 3, 5]), makeRoutine({ schedule: { type: "weekly_count", timesPerWeek: 4, timeZone: "Asia/Tokyo" } })]) {
			expect(fromNotionPage(toNotionPage(routine))).toEqual(routine);
		}
	});
});
