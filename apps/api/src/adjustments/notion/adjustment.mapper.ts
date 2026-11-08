import { z } from "zod";
import { AdjustmentSchema } from "../adjustment.schema.ts";
import type { Adjustment } from "../adjustment.schema.ts";
import type { NotionProperties } from "./notion-adjustment-client.ts";

/** 調整用データソースのプロパティ名。docs/notion-adjustment-datasource.md と一致させる。 */
export const ADJUSTMENT_PROPERTY = {
	title: "Name",
	adjustmentId: "Adjustment ID",
	kind: "Kind",
	routineId: "Routine ID",
	scheduledDate: "Scheduled Date",
	postponedTo: "Postponed To",
	cancelsId: "Cancels ID",
	reason: "Reason",
	createdAt: "Created At",
} as const;

const text = (content: string) => [{ type: "text", text: { content } }];
const optionalText = (content: string | undefined) => (content ? text(content) : []);

export function toNotionProperties(adjustment: Adjustment): NotionProperties {
	const p = ADJUSTMENT_PROPERTY;
	return {
		[p.title]: { title: text(`${adjustment.kind} ${adjustment.scheduledDate} ${adjustment.routineId}`) },
		[p.adjustmentId]: { rich_text: text(adjustment.id) },
		[p.kind]: { select: { name: adjustment.kind } },
		[p.routineId]: { rich_text: text(adjustment.routineId) },
		[p.scheduledDate]: { rich_text: text(adjustment.scheduledDate) },
		[p.postponedTo]: { rich_text: optionalText(adjustment.postponedTo) },
		[p.cancelsId]: { rich_text: optionalText(adjustment.cancelsId) },
		[p.reason]: { rich_text: optionalText(adjustment.reason) },
		[p.createdAt]: { date: { start: adjustment.createdAt } },
	};
}

const richText = z.object({ rich_text: z.array(z.object({ plain_text: z.string() })) });
const select = z.object({ select: z.object({ name: z.string() }).nullable() });
const date = z.object({ date: z.object({ start: z.string() }).nullable() });

const NotionAdjustmentPageSchema = z.object({
	properties: z.object({
		[ADJUSTMENT_PROPERTY.adjustmentId]: richText,
		[ADJUSTMENT_PROPERTY.kind]: select,
		[ADJUSTMENT_PROPERTY.routineId]: richText,
		[ADJUSTMENT_PROPERTY.scheduledDate]: richText,
		[ADJUSTMENT_PROPERTY.postponedTo]: richText,
		[ADJUSTMENT_PROPERTY.cancelsId]: richText,
		[ADJUSTMENT_PROPERTY.reason]: richText,
		[ADJUSTMENT_PROPERTY.createdAt]: date,
	}),
});

const joined = (parts: { plain_text: string }[]) => parts.map((part) => part.plain_text).join("") || undefined;

function toUtcIso(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const time = new Date(value);
	return Number.isNaN(time.getTime()) ? value : time.toISOString();
}

/** Notion のページを Adjustment に変換する。不正なら ZodError を投げる。 */
export function fromNotionPage(page: unknown): Adjustment {
	const { properties: props } = NotionAdjustmentPageSchema.parse(page);
	const p = ADJUSTMENT_PROPERTY;
	return AdjustmentSchema.parse({
		id: joined(props[p.adjustmentId].rich_text),
		kind: props[p.kind].select?.name,
		routineId: joined(props[p.routineId].rich_text),
		scheduledDate: joined(props[p.scheduledDate].rich_text),
		postponedTo: joined(props[p.postponedTo].rich_text),
		cancelsId: joined(props[p.cancelsId].rich_text),
		reason: joined(props[p.reason].rich_text),
		createdAt: toUtcIso(props[p.createdAt].date?.start),
	});
}
