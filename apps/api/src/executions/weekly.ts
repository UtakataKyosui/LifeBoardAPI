import { weekRangeOf } from "../routines/calendar.ts";
import type { LocalDate, Routine, RoutineId } from "../routines/routine.schema.ts";
import type { ExecutionRecord } from "./execution.schema.ts";

/** 週N回の実施評価。数値目標の達成（日次集計の targetStatus）とは独立。 */
export type WeeklyStatus = "achieved" | "not_achieved";

export type RoutineWeeklySummary = {
	routineId: RoutineId;
	weekStart: LocalDate;
	weekEnd: LocalDate;
	/** 週に必要な実施日数（timesPerWeek）。 */
	required: number;
	/** 1 件以上の実施がある日の数。同日に複数回実施しても 1 日と数える。 */
	executedDays: number;
	/** 週内の記録の件数。参考値で、達成判定には使わない。 */
	executionCount: number;
	status: WeeklyStatus;
};

/**
 * `date` を含む週（月曜始まり）の週N回の実施状況を、保存済みの記録から導出する純関数。
 * 対象は active な週N回の Routine のみ。記録の localDate は登録時の Routine のタイムゾーンで
 * 確定済み（EX-03）なので、ここではタイムゾーンを扱わず localDate で週に振り分ける。
 */
export function summarizeWeek(
	routines: readonly Routine[],
	records: readonly ExecutionRecord[],
	date: LocalDate,
): RoutineWeeklySummary[] {
	const { weekStart, weekEnd } = weekRangeOf(date);
	const inWeek = records.filter((record) => record.localDate >= weekStart && record.localDate <= weekEnd);
	return routines
		.flatMap((routine) =>
			routine.status === "active" && routine.schedule.type === "weekly_count"
				? [{ routine, required: routine.schedule.timesPerWeek }]
				: [],
		)
		.map(({ routine, required }) => {
			const mine = inWeek.filter((record) => record.routineId === routine.id);
			const executedDays = new Set(mine.map((record) => record.localDate)).size;
			return {
				routineId: routine.id,
				weekStart,
				weekEnd,
				required,
				executedDays,
				executionCount: mine.length,
				status: executedDays >= required ? ("achieved" as const) : ("not_achieved" as const),
			};
		})
		.sort((a, b) => a.routineId.localeCompare(b.routineId));
}
