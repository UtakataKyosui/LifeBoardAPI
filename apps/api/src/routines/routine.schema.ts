import { z } from "zod";

export const ROUTINE_CATEGORIES = ["habit", "chore", "environment", "learning"] as const;
export const ROUTINE_STATUSES = ["active", "archived"] as const;
export const TARGET_OPERATORS = ["gte", "lte", "eq", "between"] as const;

export const RoutineIdSchema = z.uuid().brand<"RoutineId">();

/** `YYYY-MM-DD` のローカル日付。実在しない日付（2月30日など）は拒否する。 */
export const LocalDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		const date = new Date(`${value}T00:00:00Z`);
		return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
	}, "存在しない日付です")
	.brand<"LocalDate">();

export const TimeZoneSchema = z.string().refine((value) => {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}, "IANA タイムゾーン名ではありません");

export const SCHEDULE_TYPES = ["daily", "weekly", "weekly_count"] as const;

/** 毎日。 */
export const DailyScheduleSchema = z.object({
	type: z.literal("daily"),
	timeZone: TimeZoneSchema,
});

/** ISO 曜日番号（月曜 = 1 … 日曜 = 7）。 */
export const IsoWeekdaySchema = z.number().int().min(1).max(7);

/** 曜日指定。指定した曜日だけ予定になる。曜日は昇順・重複なしで指定する（表現を一意にするため）。 */
export const WeeklyScheduleSchema = z.object({
	type: z.literal("weekly"),
	daysOfWeek: z
		.array(IsoWeekdaySchema)
		.min(1)
		.max(7)
		.refine((days) => days.every((day, i) => i === 0 || day > (days[i - 1] as number)), "曜日は昇順で重複なく指定してください"),
	timeZone: TimeZoneSchema,
});

/** 週N回。曜日は決めず、週（月曜始まり）に N 日実施すれば達成。特定の日の予定は持たない。 */
export const WeeklyCountScheduleSchema = z.object({
	type: z.literal("weekly_count"),
	timesPerWeek: z.number().int().min(1).max(7),
	timeZone: TimeZoneSchema,
});

export const ScheduleSchema = z.discriminatedUnion("type", [
	DailyScheduleSchema,
	WeeklyScheduleSchema,
	WeeklyCountScheduleSchema,
]);

/** 暫定: 1 Routine に 0〜1 件の目標。複数目標・適用期間は未決定（U-02）。 */
export const TargetSchema = z
	.object({
		metric: z.string().trim().min(1).max(100),
		operator: z.enum(TARGET_OPERATORS),
		value: z.number().finite().optional(),
		min: z.number().finite().optional(),
		max: z.number().finite().optional(),
		unit: z.string().trim().min(1).max(30),
	})
	.superRefine((target, ctx) => {
		if (target.operator === "between") {
			if (target.min === undefined || target.max === undefined) {
				ctx.addIssue({ code: "custom", message: "between には min と max が必要です" });
			} else if (target.min > target.max) {
				ctx.addIssue({ code: "custom", message: "min は max 以下にしてください" });
			}
			if (target.value !== undefined) {
				ctx.addIssue({ code: "custom", message: "between に value は指定できません" });
			}
		} else {
			if (target.value === undefined) {
				ctx.addIssue({ code: "custom", message: `${target.operator} には value が必要です` });
			}
			if (target.min !== undefined || target.max !== undefined) {
				ctx.addIssue({ code: "custom", message: "min と max は between でのみ指定できます" });
			}
		}
	});

/** 登録時にクライアントが指定する項目。id・status・revision・日時はサーバーが決める。 */
export const RoutineInputSchema = z.object({
	name: z.string().trim().min(1).max(100),
	category: z.enum(ROUTINE_CATEGORIES),
	purpose: z.string().trim().max(500).optional(),
	schedule: ScheduleSchema,
	target: TargetSchema.optional(),
});

export const RoutineSchema = RoutineInputSchema.extend({
	id: RoutineIdSchema,
	status: z.enum(ROUTINE_STATUSES),
	revision: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

export type Schedule = z.infer<typeof ScheduleSchema>;
export type RoutineId = z.infer<typeof RoutineIdSchema>;
export type LocalDate = z.infer<typeof LocalDateSchema>;
export type RoutineInput = z.infer<typeof RoutineInputSchema>;
export type Routine = z.infer<typeof RoutineSchema>;
