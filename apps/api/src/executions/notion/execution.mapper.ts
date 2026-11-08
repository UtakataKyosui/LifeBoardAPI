import { z } from "zod";
import { ExecutionRecordSchema } from "../execution.schema.ts";
import type { ExecutionRecord } from "../execution.schema.ts";
import type { NotionProperties } from "./notion-execution-client.ts";

/** 実施記録用データソースのプロパティ名。docs/notion-execution-datasource.md と一致させる。 */
export const EXECUTION_PROPERTY = {
	title: "Name",
	recordId: "Record ID",
	routineId: "Routine ID",
	performedAt: "Performed At",
	localDate: "Local Date",
	createdAt: "Created At",
	metric: "Measurement Metric",
	value: "Measurement Value",
	unit: "Measurement Unit",
} as const;

const text = (content: string) => [{ type: "text", text: { content } }];

export function toNotionProperties(record: ExecutionRecord): NotionProperties {
	const p = EXECUTION_PROPERTY;
	const { measurement } = record;
	return {
		[p.title]: { title: text(`${record.localDate} ${record.routineId}`) },
		[p.recordId]: { rich_text: text(record.id) },
		[p.routineId]: { rich_text: text(record.routineId) },
		[p.performedAt]: { date: { start: record.performedAt } },
		[p.localDate]: { rich_text: text(record.localDate) },
		[p.createdAt]: { date: { start: record.createdAt } },
		[p.metric]: { rich_text: measurement ? text(measurement.metric) : [] },
		// 数値なしは null、数値ゼロは 0。区別を保つ。
		[p.value]: { number: measurement ? measurement.value : null },
		[p.unit]: { rich_text: measurement ? text(measurement.unit) : [] },
	};
}

const richText = z.object({ rich_text: z.array(z.object({ plain_text: z.string() })) });
const number = z.object({ number: z.number().nullable() });
const date = z.object({ date: z.object({ start: z.string() }).nullable() });

const NotionExecutionPageSchema = z.object({
	properties: z.object({
		[EXECUTION_PROPERTY.recordId]: richText,
		[EXECUTION_PROPERTY.routineId]: richText,
		[EXECUTION_PROPERTY.performedAt]: date,
		[EXECUTION_PROPERTY.localDate]: richText,
		[EXECUTION_PROPERTY.createdAt]: date,
		[EXECUTION_PROPERTY.metric]: richText,
		[EXECUTION_PROPERTY.value]: number,
		[EXECUTION_PROPERTY.unit]: richText,
	}),
});

const joined = (parts: { plain_text: string }[]) => parts.map((part) => part.plain_text).join("");

/** Notion は UTC オフセット付きの日時を返し得るため UTC 表記に揃える。解釈できない値は検証で拒否させる。 */
function toUtcIso(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const time = new Date(value);
	return Number.isNaN(time.getTime()) ? value : time.toISOString();
}

/** Notion のページを ExecutionRecord に変換する。不正なら ZodError を投げる。 */
export function fromNotionPage(page: unknown): ExecutionRecord {
	const { properties: props } = NotionExecutionPageSchema.parse(page);
	const p = EXECUTION_PROPERTY;
	const metric = joined(props[p.metric].rich_text);
	const unit = joined(props[p.unit].rich_text);
	const value = props[p.value].number;
	// 一部だけ入力された数値を握りつぶさず検証で拒否させる（value の 0 は入力済み）。
	const hasMeasurement = Boolean(metric || unit) || value !== null;

	return ExecutionRecordSchema.parse({
		id: joined(props[p.recordId].rich_text),
		routineId: joined(props[p.routineId].rich_text),
		performedAt: toUtcIso(props[p.performedAt].date?.start),
		localDate: joined(props[p.localDate].rich_text),
		createdAt: toUtcIso(props[p.createdAt].date?.start),
		measurement: hasMeasurement ? { metric, value: value ?? undefined, unit } : undefined,
	});
}
