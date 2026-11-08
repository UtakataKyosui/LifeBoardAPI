import { toNotionProperties } from "../../src/routines/notion/routine.mapper.ts";
import type { Routine } from "../../src/routines/routine.schema.ts";
import type { NotionPageList } from "../../src/routines/notion/notion-routine-client.ts";

export const validInput = {
	name: "ストレッチ",
	category: "habit",
	purpose: "肩こり対策",
	schedule: { type: "daily", timeZone: "Asia/Tokyo" },
	target: { metric: "duration", operator: "gte", value: 10, unit: "min" },
} as const;

export function makeRoutine(overrides: Partial<Routine> = {}): Routine {
	return {
		...validInput,
		id: "3f2b8a52-7a54-4f0e-9d0f-0a6f6b3b7c11",
		status: "active",
		revision: 1,
		createdAt: "2026-10-18T00:00:00.000Z",
		updatedAt: "2026-10-18T00:00:00.000Z",
		...overrides,
	} as Routine;
}

/** Notion が返すページ形状（plain_text を持つ）にする。 */
export function toNotionPage(routine: Routine): unknown {
	const props = toNotionProperties(routine) as Record<string, Record<string, unknown>>;
	const withPlain = (value: unknown): unknown => {
		if (Array.isArray(value)) {
			return value.map((item) => {
				const content = (item as { text?: { content: string } }).text?.content;
				return content === undefined ? item : { ...(item as object), plain_text: content };
			});
		}
		return value;
	};
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
