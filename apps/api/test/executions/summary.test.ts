import { describe, expect, it } from "vitest";
import { summarizeDay } from "../../src/executions/summary.ts";
import { LocalDateSchema } from "../../src/routines/routine.schema.ts";
import { makeRoutine } from "../routines/fixtures.ts";
import { ROUTINE_ID, makeRecord } from "./fixtures.ts";
import type { Routine } from "../../src/routines/routine.schema.ts";

const date = LocalDateSchema.parse("2026-10-19");
const routine = makeRoutine(); // target: duration gte 10 min
let seq = 0;
const rec = (measurement: { metric?: string; value: number; unit?: string } | undefined, extra = {}) =>
	makeRecord({
		id: `aaaaaaaa-0000-4000-8000-${String(++seq).padStart(12, "0")}` as never,
		measurement: measurement && { metric: "duration", unit: "min", ...measurement },
		...extra,
	});

const summaryOf = (records: ReturnType<typeof rec>[], r: Routine = routine) => {
	const [summary] = summarizeDay([r], records, date);
	if (!summary) throw new Error("no summary");
	return summary;
};

describe("summarizeDay", () => {
	it("同日の複数記録を実施回数と数値合計に集計する", () => {
		const s = summaryOf([rec({ value: 6 }), rec({ value: 5 })]);
		expect(s).toMatchObject({ executionCount: 2, executed: true, targetStatus: "achieved" });
		expect(s.measurements).toEqual([{ metric: "duration", unit: "min", count: 2, sum: 11 }]);
	});

	it("数値なしの記録は回数に数えるが、数値をゼロとして加えない", () => {
		const s = summaryOf([rec(undefined), rec({ value: 4 })]);
		expect(s.executionCount).toBe(2);
		expect(s.measurements).toEqual([{ metric: "duration", unit: "min", count: 1, sum: 4 }]);
	});

	it("数値が 1 件も無ければ no_data（未達ではない）で、実施有無は別に true", () => {
		const s = summaryOf([rec(undefined)]);
		expect(s).toMatchObject({ executed: true, targetStatus: "no_data", measurements: [] });
	});

	it("数値ゼロは入力済みとして未達と判定する", () => {
		const s = summaryOf([rec({ value: 0 })]);
		expect(s).toMatchObject({ executionCount: 1, targetStatus: "not_achieved" });
		expect(s.measurements[0]).toMatchObject({ count: 1, sum: 0 });
	});

	it("実施有無と目標達成を分離する（実施なしは executed=false・no_data）", () => {
		expect(summaryOf([])).toMatchObject({ executionCount: 0, executed: false, targetStatus: "no_data" });
	});

	it("目標が無い Routine は no_target", () => {
		const { target: _target, ...rest } = routine;
		expect(summaryOf([rec({ value: 3 })], rest as Routine).targetStatus).toBe("no_target");
	});

	it.each([
		["lte", { operator: "lte", value: 10 }, 10, "achieved"],
		["lte", { operator: "lte", value: 10 }, 11, "not_achieved"],
		["eq", { operator: "eq", value: 10 }, 10, "achieved"],
		["eq", { operator: "eq", value: 10 }, 9, "not_achieved"],
		["between", { operator: "between", min: 5, max: 10 }, 5, "achieved"],
		["between", { operator: "between", min: 5, max: 10 }, 10.5, "not_achieved"],
	])("%s の目標を判定する", (_name, targetPart, value, expected) => {
		const r = makeRoutine({
			target: { metric: "duration", unit: "min", ...targetPart } as Routine["target"],
		});
		expect(summaryOf([rec({ value })], r).targetStatus).toBe(expected);
	});

	it("目標と metric・単位が異なる数値は目標判定に使わない（換算しない）", () => {
		const s = summaryOf([rec({ value: 100, unit: "sec" })]);
		expect(s.targetStatus).toBe("no_data");
		expect(s.measurements).toEqual([{ metric: "duration", unit: "sec", count: 1, sum: 100 }]);
	});

	it("他の日付・他の Routine の記録を混ぜない", () => {
		const other = rec({ value: 99 }, { localDate: "2026-10-20" });
		const otherRoutine = rec({ value: 99 }, { routineId: "bbbbbbbb-0000-4000-8000-000000000009" });
		const s = summaryOf([rec({ value: 3 }), other, otherRoutine]);
		expect(s.executionCount).toBe(1);
		expect(s.routineId).toBe(ROUTINE_ID);
	});

	it("archived は記録がある日だけ含める", () => {
		const archived = makeRoutine({ id: "cccccccc-0000-4000-8000-000000000003" as never, status: "archived" });
		expect(summarizeDay([archived], [], date)).toEqual([]);
		const withRecord = rec({ value: 1 }, { routineId: archived.id });
		expect(summarizeDay([archived], [withRecord], date)).toHaveLength(1);
	});

	it.each([
		[{ operator: "eq", value: 0.3 }, [0.1, 0.2], "achieved"],
		[{ operator: "lte", value: 0.3 }, [0.1, 0.2], "achieved"],
		[{ operator: "gte", value: 0.8 }, [0.1, 0.7], "achieved"],
		[{ operator: "between", min: 0.3, max: 0.3 }, [0.1, 0.2], "achieved"],
		[{ operator: "gte", value: 0.31 }, [0.1, 0.2], "not_achieved"],
	])("小数の加算誤差で判定を変えない: %j", (targetPart, values, expected) => {
		const r = makeRoutine({ target: { metric: "duration", unit: "min", ...targetPart } as Routine["target"] });
		const s = summaryOf(values.map((value) => rec({ value })), r);
		expect(s.targetStatus).toBe(expected);
		expect(s.measurements[0]?.sum).toBe(values.length === 2 && values[0] === 0.1 && values[1] === 0.2 ? 0.3 : s.measurements[0]?.sum);
	});
});
