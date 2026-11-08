import { describe, expect, it } from "vitest";
import { activeAdjustments, adjustedOccurrencesOn } from "../../src/adjustments/adjust.ts";
import { LocalDateSchema } from "../../src/routines/routine.schema.ts";
import { makeRoutine } from "../routines/fixtures.ts";
import type { Adjustment } from "../../src/adjustments/adjustment.schema.ts";

const d = (value: string) => LocalDateSchema.parse(value);
const routine = makeRoutine({ schedule: { type: "weekly", daysOfWeek: [1, 3], timeZone: "Asia/Tokyo" } });
const adj = (overrides: Partial<Adjustment>): Adjustment =>
	({
		id: "aaaaaaaa-0000-4000-8000-000000000001",
		kind: "skipped",
		routineId: routine.id,
		scheduledDate: "2026-10-19",
		createdAt: "2026-10-18T00:00:00.000Z",
		...overrides,
	}) as Adjustment;

describe("adjustedOccurrencesOn", () => {
	it("調整がなければ pending", () => {
		expect(adjustedOccurrencesOn([routine], [], d("2026-10-19"))).toMatchObject([{ status: "pending" }]);
	});

	it("スキップは skipped として残り、予定日自体は消えない", () => {
		expect(adjustedOccurrencesOn([routine], [adj({})], d("2026-10-19"))).toMatchObject([
			{ status: "skipped", adjustmentId: "aaaaaaaa-0000-4000-8000-000000000001" },
		]);
	});

	it("延期は延期元に postponed、延期先に postponedFrom 付きで現れる", () => {
		const postponed = adj({ kind: "postponed", postponedTo: d("2026-10-22") });
		expect(adjustedOccurrencesOn([routine], [postponed], d("2026-10-19"))).toMatchObject([
			{ status: "postponed", postponedTo: "2026-10-22" },
		]);
		expect(adjustedOccurrencesOn([routine], [postponed], d("2026-10-22"))).toMatchObject([
			{ status: "pending", postponedFrom: "2026-10-19", occurrenceKey: `${routine.id}:2026-10-22` },
		]);
	});

	it("取消済みの調整は無視する", () => {
		const skip = adj({});
		const cancel = adj({ id: "aaaaaaaa-0000-4000-8000-000000000002" as never, kind: "cancelled", cancelsId: skip.id });
		expect(activeAdjustments([skip, cancel])).toEqual([]);
		expect(adjustedOccurrencesOn([routine], [skip, cancel], d("2026-10-19"))).toMatchObject([{ status: "pending" }]);
	});

	it("入力の調整履歴を変更しない", () => {
		const list = [adj({}), adj({ id: "aaaaaaaa-0000-4000-8000-000000000002" as never, kind: "cancelled", cancelsId: adj({}).id })];
		const before = JSON.stringify(list);
		adjustedOccurrencesOn([routine], list, d("2026-10-19"));
		expect(JSON.stringify(list)).toBe(before);
	});

	it("archived の Routine は出さない", () => {
		expect(adjustedOccurrencesOn([{ ...routine, status: "archived" }], [], d("2026-10-19"))).toEqual([]);
	});
});
