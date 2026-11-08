import { isScheduledOn } from "../routines/occurrence.ts";
import type { LocalDate, Routine, RoutineId } from "../routines/routine.schema.ts";
import type { Adjustment, AdjustmentId } from "./adjustment.schema.ts";

/** 取り消されていない skipped / postponed。 */
export function activeAdjustments(adjustments: readonly Adjustment[]): Adjustment[] {
	const cancelled = new Set(adjustments.flatMap((a) => (a.kind === "cancelled" && a.cancelsId ? [a.cancelsId] : [])));
	return adjustments.filter((a) => a.kind !== "cancelled" && !cancelled.has(a.id));
}

/** pending: 予定どおり。skipped / postponed: 元の予定日にその調整が有効。いずれも実施済みを意味しない。 */
export type AdjustedStatus = "pending" | "skipped" | "postponed";

export type AdjustedOccurrence = {
	occurrenceKey: string;
	routineId: RoutineId;
	scheduledDate: LocalDate;
	status: AdjustedStatus;
	adjustmentId?: AdjustmentId;
	/** 延期元の予定日に出ているとき、延期先。 */
	postponedTo?: LocalDate;
	/** 延期先の予定日に出ているとき、延期元の予定日と調整 ID。 */
	postponedFrom?: LocalDate;
};

/**
 * ある日の予定に有効な調整を重ねる純関数。
 * - 元の予定日: 周期上の予定に skipped / postponed を付ける
 * - 延期先の日: 延期された予定を postponedFrom 付きの pending として加える
 * 対象は active な Routine のみ。履歴（cancelled を含む全イベント）は変更せず参照するだけ。
 */
export function adjustedOccurrencesOn(
	routines: readonly Routine[],
	adjustments: readonly Adjustment[],
	date: LocalDate,
): AdjustedOccurrence[] {
	const active = activeAdjustments(adjustments);
	const result: AdjustedOccurrence[] = [];
	for (const routine of routines) {
		if (routine.status !== "active") continue;
		const mine = active.filter((a) => a.routineId === routine.id);
		if (isScheduledOn(routine.schedule, date)) {
			const adjustment = mine.find((a) => a.scheduledDate === date);
			result.push({
				occurrenceKey: `${routine.id}:${date}`,
				routineId: routine.id,
				scheduledDate: date,
				status: adjustment?.kind === "skipped" || adjustment?.kind === "postponed" ? adjustment.kind : "pending",
				...(adjustment ? { adjustmentId: adjustment.id } : {}),
				...(adjustment?.postponedTo ? { postponedTo: adjustment.postponedTo } : {}),
			});
		}
		for (const adjustment of mine) {
			if (adjustment.kind === "postponed" && adjustment.postponedTo === date) {
				result.push({
					occurrenceKey: `${routine.id}:${date}`,
					routineId: routine.id,
					scheduledDate: date,
					status: "pending",
					adjustmentId: adjustment.id,
					postponedFrom: adjustment.scheduledDate,
				});
			}
		}
	}
	return result.sort((a, b) => a.occurrenceKey.localeCompare(b.occurrenceKey));
}
