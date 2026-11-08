import { isoWeekdayOf } from "./calendar.ts";
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

/** その日が周期上の予定日か。週N回は日を決めないため予定日を持たない。 */
export function isScheduledOn(schedule: Routine["schedule"], date: LocalDate): boolean {
	switch (schedule.type) {
		case "daily":
			return true;
		case "weekly":
			return schedule.daysOfWeek.includes(isoWeekdayOf(date));
		case "weekly_count":
			return false;
	}
}

/**
 * 指定したローカル日付の予定を算出する。毎日は常に 1 件、曜日指定は該当曜日のみ、週N回は 0 件。
 * `date` を省略した場合は、各 Routine のタイムゾーンでの `now` の日付を使う。
 */
export function occurrencesOn(
	routines: readonly Routine[],
	target: { date: LocalDate } | { now: Date },
): Occurrence[] {
	return routines
		.filter((routine) => routine.status === "active")
		.map((routine) => ({
			routine,
			scheduledDate: "date" in target ? target.date : localDateOf(target.now, routine.schedule.timeZone),
		}))
		.filter(({ routine, scheduledDate }) => isScheduledOn(routine.schedule, scheduledDate))
		.map(({ routine, scheduledDate }) => ({
			occurrenceKey: `${routine.id}:${scheduledDate}`,
			routineId: routine.id,
			scheduledDate,
		}))
		.sort((a, b) => a.occurrenceKey.localeCompare(b.occurrenceKey));
}
