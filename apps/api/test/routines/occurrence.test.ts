import { describe, expect, it } from "vitest";
import { localDateOf, occurrencesOn } from "../../src/routines/occurrence.ts";
import { LocalDateSchema } from "../../src/routines/routine.schema.ts";
import { makeRoutine } from "./fixtures.ts";

const tokyo = makeRoutine({ id: "aaaaaaaa-0000-4000-8000-000000000001" as never });
const newYork = makeRoutine({
	id: "bbbbbbbb-0000-4000-8000-000000000002" as never,
	schedule: { type: "daily", timeZone: "America/New_York" },
});
const date = LocalDateSchema.parse("2026-10-19");

describe("occurrencesOn", () => {
	it("指定日の予定を active な Routine ごとに 1 件返す", () => {
		const archived = makeRoutine({ id: "cccccccc-0000-4000-8000-000000000003" as never, status: "archived" });
		expect(occurrencesOn([tokyo, archived], { date })).toEqual([
			{ occurrenceKey: `${tokyo.id}:2026-10-19`, routineId: tokyo.id, scheduledDate: "2026-10-19" },
		]);
	});

	it("同じ入力から同じ結果を返し、入力順に依存しない", () => {
		expect(occurrencesOn([newYork, tokyo], { date })).toEqual(occurrencesOn([tokyo, newYork], { date }));
	});

	it("0 件の Routine では空配列を返す", () => {
		expect(occurrencesOn([], { date })).toEqual([]);
	});

	it("date 省略時は各 Routine のタイムゾーンで日付境界を評価する", () => {
		// UTC 2026-10-19 20:00 → 東京は 10/20 05:00、ニューヨークは 10/19 16:00
		const now = new Date("2026-10-19T20:00:00Z");
		const result = occurrencesOn([tokyo, newYork], { now });
		expect(result.find((o) => o.routineId === tokyo.id)?.scheduledDate).toBe("2026-10-20");
		expect(result.find((o) => o.routineId === newYork.id)?.scheduledDate).toBe("2026-10-19");
	});
});

describe("localDateOf", () => {
	it("日付境界の直前・直後を切り分ける", () => {
		expect(localDateOf(new Date("2026-10-18T14:59:59Z"), "Asia/Tokyo")).toBe("2026-10-18");
		expect(localDateOf(new Date("2026-10-18T15:00:00Z"), "Asia/Tokyo")).toBe("2026-10-19");
	});

	it("夏時間の切り替え日でも現地の日付を返す", () => {
		// 米国の夏時間終了（2026-11-01）。UTC 05:00 は EDT で 01:00。
		expect(localDateOf(new Date("2026-11-01T04:59:59Z"), "America/New_York")).toBe("2026-11-01");
		expect(localDateOf(new Date("2026-11-01T05:00:00Z"), "America/New_York")).toBe("2026-11-01");
		expect(localDateOf(new Date("2026-11-02T04:59:59Z"), "America/New_York")).toBe("2026-11-01");
		expect(localDateOf(new Date("2026-11-02T05:00:00Z"), "America/New_York")).toBe("2026-11-02");
	});
});
