import type { LocalDate } from "./routine.schema.ts";

/** ISO 8601 の曜日番号。月曜 = 1 … 日曜 = 7。 */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (date: LocalDate) => Date.parse(`${date}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10) as LocalDate;

/**
 * ローカル日付の曜日。`YYYY-MM-DD` はすでにタイムゾーンで確定したカレンダー日付なので、
 * UTC 0 時として扱っても曜日は変わらない（夏時間・タイムゾーンに依存しない）。
 */
export function isoWeekdayOf(date: LocalDate): IsoWeekday {
	const day = new Date(toUtc(date)).getUTCDay();
	return (day === 0 ? 7 : day) as IsoWeekday;
}

export function addDays(date: LocalDate, days: number): LocalDate {
	return fromUtc(toUtc(date) + days * DAY_MS);
}

/** 週は月曜始まり（ISO 8601）。`date` を含む週の月曜と日曜を返す。 */
export function weekRangeOf(date: LocalDate): { weekStart: LocalDate; weekEnd: LocalDate } {
	const weekStart = addDays(date, 1 - isoWeekdayOf(date));
	return { weekStart, weekEnd: addDays(weekStart, 6) };
}
