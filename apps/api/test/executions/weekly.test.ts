import { describe, expect, it } from "vitest";
import { summarizeDay } from "../../src/executions/summary.ts";
import { summarizeWeek } from "../../src/executions/weekly.ts";
import { LocalDateSchema } from "../../src/routines/routine.schema.ts";
import { makeRoutine } from "../routines/fixtures.ts";
import { makeRecord } from "./fixtures.ts";

const d = (value: string) => LocalDateSchema.parse(value);
const routine = makeRoutine({
	schedule: { type: "weekly_count", timesPerWeek: 3, timeZone: "Asia/Tokyo" },
	target: { metric: "duration", operator: "gte", value: 10, unit: "min" },
});
let seq = 0;
const rec = (localDate: string, extra = {}) =>
	makeRecord({ id: `aaaaaaaa-0000-4000-8000-${String(++seq).padStart(12, "0")}` as never, localDate: d(localDate), ...extra });
const week = (records: ReturnType<typeof rec>[], date = "2026-10-21") => {
	const [summary] = summarizeWeek([routine], records, d(date));
	if (!summary) throw new Error("no summary");
	return summary;
};

describe("summarizeWeek", () => {
	it("実施した日数で数え、達成を判定する", () => {
		const s = week([rec("2026-10-19"), rec("2026-10-21"), rec("2026-10-25")]);
		expect(s).toMatchObject({ weekStart: "2026-10-19", weekEnd: "2026-10-25", required: 3, executedDays: 3, status: "achieved" });
	});

	it("同日の複数実施は 1 日と数え、回数は別に出す", () => {
		const s = week([rec("2026-10-19"), rec("2026-10-19"), rec("2026-10-19")]);
		expect(s).toMatchObject({ executedDays: 1, executionCount: 3, status: "not_achieved" });
	});

	it("週境界: 日曜は同じ週、翌月曜と前週日曜は含めない", () => {
		const s = week([rec("2026-10-18"), rec("2026-10-19"), rec("2026-10-25"), rec("2026-10-26")]);
		expect(s).toMatchObject({ executedDays: 2, executionCount: 2 });
	});

	it("週のどの日を指定しても同じ週を評価する", () => {
		const records = [rec("2026-10-20")];
		expect(week(records, "2026-10-19")).toEqual(week(records, "2026-10-25"));
	});

	it("記録なしは 0 日で未達", () => {
		expect(week([])).toMatchObject({ executedDays: 0, executionCount: 0, status: "not_achieved" });
	});

	it("他の Routine の記録は数えない", () => {
		expect(week([rec("2026-10-19", { routineId: "99999999-0000-4000-8000-000000000009" as never })]).executedDays).toBe(0);
	});

	it("実施評価と数値達成を分離する: 数値が未達でも実施日数で達成になる", () => {
		const records = [rec("2026-10-19", { measurement: { metric: "duration", value: 1, unit: "min" } }), rec("2026-10-20"), rec("2026-10-21")];
		expect(week(records).status).toBe("achieved");
		const [daily] = summarizeDay([routine], records, d("2026-10-19"));
		expect(daily?.targetStatus).toBe("not_achieved");
	});

	it("週N回以外・archived の Routine は対象にしない", () => {
		const daily = makeRoutine({ id: "bbbbbbbb-0000-4000-8000-000000000002" as never });
		const archived = makeRoutine({ ...routine, id: "cccccccc-0000-4000-8000-000000000003" as never, status: "archived" });
		expect(summarizeWeek([daily, archived], [], d("2026-10-19"))).toEqual([]);
	});
});
