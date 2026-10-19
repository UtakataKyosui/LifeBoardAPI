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

/**
 * Notion のページをドメインの Routine に変換する。ページ形状またはドメイン制約に
 * 合わない場合は ZodError を投げる（呼び出し側が不正データとして扱う）。
 */
export function fromNotionPage(page: unknown): Routine {
	const { properties: props } = NotionRoutinePageSchema.parse(page);
	const p = ROUTINE_PROPERTY;
	const metric = joined(props[p.targetMetric].rich_text);
	const operator = props[p.targetOperator].select?.name;

	return RoutineSchema.parse({
		id: joined(props[p.routineId].rich_text),
		name: joined(props[p.name].title),
		category: props[p.category].select?.name,
		purpose: joined(props[p.purpose].rich_text) || undefined,
		status: props[p.status].select?.name,
		schedule: {
			type: props[p.scheduleType].select?.name,
			timeZone: joined(props[p.timeZone].rich_text),
		},
		revision: props[p.revision].number ?? undefined,
		createdAt: props[p.createdAt].date?.start,
		updatedAt: props[p.updatedAt].date?.start,
		target:
			metric || operator
				? {
						metric,
						operator,
						value: orUndefined(props[p.targetValue].number),
						min: orUndefined(props[p.targetMin].number),
						max: orUndefined(props[p.targetMax].number),
						unit: joined(props[p.targetUnit].rich_text),
					}
				: undefined,
	});
}
