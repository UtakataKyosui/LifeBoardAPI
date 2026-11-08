import type { LocalDate, Routine, RoutineId } from "../routines/routine.schema.ts";
import type { ExecutionRecord } from "./execution.schema.ts";

/**
 * - achieved / not_achieved: 目標と同じ metric・unit の数値があり、合計で判定できた
 * - no_data: 目標はあるが、対応する数値が 1 件も無い（0 とはみなさない）
 * - no_target: Routine に目標が無い
 */
export type TargetStatus = "achieved" | "not_achieved" | "no_data" | "no_target";

export type MeasurementTotal = { metric: string; unit: string; count: number; sum: number };

export type RoutineDailySummary = {
	routineId: RoutineId;
	date: LocalDate;
	/** 実施回数。数値の有無に関わらず記録の件数。 */
	executionCount: number;
	/** 実施有無。数値目標の達成とは独立。 */
	executed: boolean;
	/** 数値は metric・unit ごとに合計する。単位換算はしない。数値なしの記録は含めない。 */
	measurements: MeasurementTotal[];
	targetStatus: TargetStatus;
};

function evaluate(target: NonNullable<Routine["target"]>, sum: number): boolean {
	switch (target.operator) {
		case "gte":
			return sum >= (target.value as number);
		case "lte":
			return sum <= (target.value as number);
		case "eq":
			return sum === target.value;
		case "between":
			return sum >= (target.min as number) && sum <= (target.max as number);
	}
}

/**
 * 保存済みの実施記録から、ある日の Routine ごとの集計を導出する。
 * `records` は `date` の記録だけでなくてもよい（他の日付は無視する）。
 * 対象は active な Routine と、その日に記録がある Routine。
 */
export function summarizeDay(
	routines: readonly Routine[],
	records: readonly ExecutionRecord[],
	date: LocalDate,
): RoutineDailySummary[] {
	const ofDay = records.filter((record) => record.localDate === date);
	return routines
		.map((routine) => ({ routine, mine: ofDay.filter((record) => record.routineId === routine.id) }))
		.filter(({ routine, mine }) => routine.status === "active" || mine.length > 0)
		.map(({ routine, mine }) => {
			const groups = new Map<string, MeasurementTotal>();
			for (const { measurement } of mine) {
				if (!measurement) continue;
				const key = JSON.stringify([measurement.metric, measurement.unit]);
				const group = groups.get(key) ?? { metric: measurement.metric, unit: measurement.unit, count: 0, sum: 0 };
				group.count += 1;
				group.sum += measurement.value;
				groups.set(key, group);
			}
			const measurements = [...groups.values()].sort((a, b) =>
				`${a.metric}\u0000${a.unit}`.localeCompare(`${b.metric}\u0000${b.unit}`),
			);

			const { target } = routine;
			const matching = target && measurements.find((m) => m.metric === target.metric && m.unit === target.unit);
			const targetStatus: TargetStatus = !target
				? "no_target"
				: !matching
					? "no_data"
					: evaluate(target, matching.sum)
						? "achieved"
						: "not_achieved";

			return {
				routineId: routine.id,
				date,
				executionCount: mine.length,
				executed: mine.length > 0,
				measurements,
				targetStatus,
			};
		})
		.sort((a, b) => a.routineId.localeCompare(b.routineId));
}
