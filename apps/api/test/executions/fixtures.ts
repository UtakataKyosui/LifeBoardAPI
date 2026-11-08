import { toNotionProperties } from "../../src/executions/notion/execution.mapper.ts";
import type { ExecutionRecord } from "../../src/executions/execution.schema.ts";
import type { NotionPageList } from "../../src/executions/notion/notion-execution-client.ts";

export const ROUTINE_ID = "3f2b8a52-7a54-4f0e-9d0f-0a6f6b3b7c11";

export function makeRecord(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
	return {
		id: "11111111-0000-4000-8000-000000000001",
		routineId: ROUTINE_ID,
		performedAt: "2026-10-19T00:30:00.000Z",
		localDate: "2026-10-19",
		measurement: { metric: "duration", value: 10, unit: "min" },
		createdAt: "2026-10-19T01:00:00.000Z",
		...overrides,
	} as ExecutionRecord;
}

/** Notion が返すページ形状（plain_text を持つ）にする。 */
export function toNotionPage(record: ExecutionRecord): unknown {
	const props = toNotionProperties(record) as Record<string, Record<string, unknown>>;
	const withPlain = (value: unknown): unknown =>
		Array.isArray(value)
			? value.map((item) => {
					const content = (item as { text?: { content: string } }).text?.content;
					return content === undefined ? item : { ...(item as object), plain_text: content };
				})
			: value;
	return {
		properties: Object.fromEntries(
			Object.entries(props).map(([name, prop]) => [
				name,
				Object.fromEntries(Object.entries(prop).map(([key, value]) => [key, withPlain(value)])),
			]),
		),
	};
}

export function page(results: unknown[], nextCursor: string | null = null): NotionPageList {
	return { results, hasMore: nextCursor !== null, nextCursor };
}
