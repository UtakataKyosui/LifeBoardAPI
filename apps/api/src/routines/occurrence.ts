import type { LocalDate, Routine } from "./routine.schema.ts";

export type Occurrence = {
	occurrenceKey: string;
	routineId: Routine["id"];
	scheduledDate: LocalDate;
};

/** `instant` を `timeZone` のローカル日付に変換する。日付境界はこのタイムゾーンで決まる。 */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(instant);
	const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}` as LocalDate;
}

/**
 * 指定したローカル日付の予定を算出する。MVP は毎日のみなので、active な Routine は
 * 必ず 1 件の予定を持つ。`date` を省略した場合は、各 Routine のタイムゾーンでの `now` の日付を使う。
 */
export function occurrencesOn(
	routines: readonly Routine[],
	target: { date: LocalDate } | { now: Date },
): Occurrence[] {
	return routines
		.filter((routine) => routine.status === "active")
		.map((routine) => {
			const scheduledDate =
				"date" in target ? target.date : localDateOf(target.now, routine.schedule.timeZone);
			return {
				occurrenceKey: `${routine.id}:${scheduledDate}`,
				routineId: routine.id,
				scheduledDate,
			};
		})
		.sort((a, b) => a.occurrenceKey.localeCompare(b.occurrenceKey));
}
