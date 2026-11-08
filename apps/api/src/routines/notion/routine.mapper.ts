import { z } from "zod";
import { RoutineSchema } from "../routine.schema.ts";
import type { Routine } from "../routine.schema.ts";
import type { NotionProperties } from "./notion-routine-client.ts";

/** Routine 用データソースのプロパティ名。docs/notion-routine-datasource.md と一致させる。 */
export const ROUTINE_PROPERTY = {
	name: "Name",
	routineId: "Routine ID",
	category: "Category",
	purpose: "Purpose",
	status: "Status",
	scheduleType: "Schedule Type",
	timeZone: "Time Zone",
	daysOfWeek: "Days Of Week",
	timesPerWeek: "Times Per Week",
	revision: "Revision",
	createdAt: "Created At",
	updatedAt: "Updated At",
	targetMetric: "Target Metric",
	targetOperator: "Target Operator",
	targetValue: "Target Value",
	targetMin: "Target Min",
	targetMax: "Target Max",
	targetUnit: "Target Unit",
} as const;

const text = (content: string) => [{ type: "text", text: { content } }];

export function toNotionProperties(routine: Routine): NotionProperties {
	const p = ROUTINE_PROPERTY;
	const { target } = routine;
	return {
		[p.name]: { title: text(routine.name) },
		[p.routineId]: { rich_text: text(routine.id) },
		[p.category]: { select: { name: routine.category } },
		[p.purpose]: { rich_text: routine.purpose ? text(routine.purpose) : [] },
		[p.status]: { select: { name: routine.status } },
		[p.scheduleType]: { select: { name: routine.schedule.type } },
		[p.timeZone]: { rich_text: text(routine.schedule.timeZone) },
		[p.daysOfWeek]: {
			rich_text: routine.schedule.type === "weekly" ? text(routine.schedule.daysOfWeek.join(",")) : [],
		},
		[p.timesPerWeek]: {
			number: routine.schedule.type === "weekly_count" ? routine.schedule.timesPerWeek : null,
		},
		[p.revision]: { number: routine.revision },
		[p.createdAt]: { date: { start: routine.createdAt } },
		[p.updatedAt]: { date: { start: routine.updatedAt } },
		[p.targetMetric]: { rich_text: target ? text(target.metric) : [] },
		[p.targetOperator]: { select: target ? { name: target.operator } : null },
		[p.targetValue]: { number: target?.value ?? null },
		[p.targetMin]: { number: target?.min ?? null },
		[p.targetMax]: { number: target?.max ?? null },
		[p.targetUnit]: { rich_text: target ? text(target.unit) : [] },
	};
}

const richText = z.object({ rich_text: z.array(z.object({ plain_text: z.string() })) });
const select = z.object({ select: z.object({ name: z.string() }).nullable() });
const number = z.object({ number: z.number().nullable() });
const date = z.object({ date: z.object({ start: z.string() }).nullable() });

const NotionRoutinePageSchema = z.object({
	properties: z.object({
		[ROUTINE_PROPERTY.name]: z.object({ title: z.array(z.object({ plain_text: z.string() })) }),
		[ROUTINE_PROPERTY.routineId]: richText,
		[ROUTINE_PROPERTY.category]: select,
		[ROUTINE_PROPERTY.purpose]: richText,
		[ROUTINE_PROPERTY.status]: select,
		[ROUTINE_PROPERTY.scheduleType]: select,
		[ROUTINE_PROPERTY.timeZone]: richText,
		[ROUTINE_PROPERTY.daysOfWeek]: richText,
		[ROUTINE_PROPERTY.timesPerWeek]: number,
		[ROUTINE_PROPERTY.revision]: number,
		[ROUTINE_PROPERTY.createdAt]: date,
		[ROUTINE_PROPERTY.updatedAt]: date,
		[ROUTINE_PROPERTY.targetMetric]: richText,
		[ROUTINE_PROPERTY.targetOperator]: select,
		[ROUTINE_PROPERTY.targetValue]: number,
		[ROUTINE_PROPERTY.targetMin]: number,
		[ROUTINE_PROPERTY.targetMax]: number,
		[ROUTINE_PROPERTY.targetUnit]: richText,
	}),
});

const joined = (parts: { plain_text: string }[]) => parts.map((part) => part.plain_text).join("");
const orUndefined = <T>(value: T | null | undefined) => value ?? undefined;

/** Notion は UTC オフセット付きの日時を返し得るため、ドメインの UTC 表記に揃える。解釈できない値はそのまま渡して検証で拒否させる。 */
function toUtcIso(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const time = new Date(value);
	return Number.isNaN(time.getTime()) ? value : time.toISOString();
}

/** "1,3,5" を数値配列にする。空は undefined。数値でない要素は NaN にして検証で拒否させる。 */
function parseDays(value: string): number[] | undefined {
	return value.trim() === "" ? undefined : value.split(",").map((part) => Number(part.trim() || Number.NaN));
}

/**
 * Notion のページをドメインの Routine に変換する。ページ形状またはドメイン制約に
 * 合わない場合は ZodError を投げる（呼び出し側が不正データとして扱う）。
 */
export function fromNotionPage(page: unknown): Routine {
	const { properties: props } = NotionRoutinePageSchema.parse(page);
	const p = ROUTINE_PROPERTY;
	const metric = joined(props[p.targetMetric].rich_text);
	const operator = props[p.targetOperator].select?.name;
	const unit = joined(props[p.targetUnit].rich_text);
	const numbers = [props[p.targetValue].number, props[p.targetMin].number, props[p.targetMax].number];
	// 一部のプロパティだけ入力された目標を握りつぶさず、検証で拒否させる（0 は入力済み）。
	const hasTarget = Boolean(metric || operator || unit) || numbers.some((n) => n !== null);

	return RoutineSchema.parse({
		id: joined(props[p.routineId].rich_text),
		name: joined(props[p.name].title),
		category: props[p.category].select?.name,
		purpose: joined(props[p.purpose].rich_text) || undefined,
		status: props[p.status].select?.name,
		schedule: {
			type: props[p.scheduleType].select?.name,
			timeZone: joined(props[p.timeZone].rich_text),
			// 周期種別に無関係な値は空・null になる。ここで解釈できない値は検証で拒否させる。
			daysOfWeek: parseDays(joined(props[p.daysOfWeek].rich_text)),
			timesPerWeek: orUndefined(props[p.timesPerWeek].number),
		},
		revision: props[p.revision].number ?? undefined,
		createdAt: toUtcIso(props[p.createdAt].date?.start),
		updatedAt: toUtcIso(props[p.updatedAt].date?.start),
		target:
			hasTarget
				? {
						metric,
						operator,
						value: orUndefined(props[p.targetValue].number),
						min: orUndefined(props[p.targetMin].number),
						max: orUndefined(props[p.targetMax].number),
						unit,
					}
				: undefined,
	});
}
