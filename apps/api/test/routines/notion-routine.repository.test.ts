import { describe, expect, it, vi } from "vitest";
import { NotionRoutineClient } from "../../src/routines/notion/notion-routine-client.ts";
import { NotionRoutineRepository } from "../../src/routines/notion/notion-routine.repository.ts";
import { fromNotionPage } from "../../src/routines/notion/routine.mapper.ts";
import { RoutineDataInvalidError, RoutineStorageError } from "../../src/routines/routine.repository.ts";
import { makeRoutine, page, toNotionPage } from "./fixtures.ts";

function setup(client: Partial<NotionRoutineClient>) {
	return new NotionRoutineRepository(client as NotionRoutineClient);
}

describe("Routine mapper", () => {
	it("ドメインから Notion 形式を経由して元の Routine に戻る", () => {
		const routine = makeRoutine();
		expect(fromNotionPage(toNotionPage(routine))).toEqual(routine);
	});

	it("目標・purpose なしの Routine も往復できる", () => {
		const routine = makeRoutine({ target: undefined, purpose: undefined });
		expect(fromNotionPage(toNotionPage(routine))).toEqual(routine);
	});

	it("目標の数値未入力をゼロとして扱わない", () => {
		const routine = makeRoutine({
			target: { metric: "steps", operator: "gte", unit: "count" } as never,
		});
		expect(() => fromNotionPage(toNotionPage(routine))).toThrow();
	});

	it("必須プロパティの欠落を拒否する", () => {
		const broken = toNotionPage(makeRoutine()) as { properties: Record<string, unknown> };
		delete broken.properties.Status;
		expect(() => fromNotionPage(broken)).toThrow();
	});
});

describe("NotionRoutineRepository.save", () => {
	it("Notion の応答を検証して返す", async () => {
		const routine = makeRoutine();
		const repo = setup({ createPage: vi.fn().mockResolvedValue(toNotionPage(routine)) });
		await expect(repo.save(routine)).resolves.toEqual(routine);
	});

	it("Notion の失敗を RoutineStorageError にする", async () => {
		const repo = setup({ createPage: vi.fn().mockRejectedValue(new Error("rate_limited")) });
		await expect(repo.save(makeRoutine())).rejects.toBeInstanceOf(RoutineStorageError);
	});

	it("応答が不正なら成功として扱わない", async () => {
		const repo = setup({ createPage: vi.fn().mockResolvedValue({ id: "x" }) });
		await expect(repo.save(makeRoutine())).rejects.toBeInstanceOf(RoutineDataInvalidError);
	});
});

describe("NotionRoutineRepository.listAll", () => {
	const a = makeRoutine({ id: "aaaaaaaa-0000-4000-8000-000000000001" as never });
	const b = makeRoutine({ id: "bbbbbbbb-0000-4000-8000-000000000002" as never });
	const c = makeRoutine({ id: "cccccccc-0000-4000-8000-000000000003" as never });

	it("0 件を扱える", async () => {
		const repo = setup({ queryPages: vi.fn().mockResolvedValue(page([])) });
		await expect(repo.listAll()).resolves.toEqual([]);
	});

	it("複数ページを欠落なく順に取得する", async () => {
		const queryPages = vi
			.fn()
			.mockResolvedValueOnce(page([toNotionPage(a), toNotionPage(b)], "cursor-1"))
			.mockResolvedValueOnce(page([toNotionPage(c)]));
		const result = await setup({ queryPages }).listAll();

		expect(result).toEqual([a, b, c]);
		expect(queryPages).toHaveBeenNthCalledWith(1, undefined);
		expect(queryPages).toHaveBeenNthCalledWith(2, "cursor-1");
	});

	it("不正な外部データがあれば一部だけ返さず失敗にする", async () => {
		const repo = setup({
			queryPages: vi.fn().mockResolvedValue(page([toNotionPage(a), { properties: {} }])),
		});
		await expect(repo.listAll()).rejects.toBeInstanceOf(RoutineDataInvalidError);
	});

	it("途中ページの API 失敗を握りつぶさない", async () => {
		const queryPages = vi
			.fn()
			.mockResolvedValueOnce(page([toNotionPage(a)], "cursor-1"))
			.mockRejectedValueOnce(new Error("boom"));
		await expect(setup({ queryPages }).listAll()).rejects.toBeInstanceOf(RoutineStorageError);
	});

	it("hasMore なのにカーソルが無ければ不正とする", async () => {
		const repo = setup({
			queryPages: vi.fn().mockResolvedValue({ results: [], hasMore: true, nextCursor: null }),
		});
		await expect(repo.listAll()).rejects.toBeInstanceOf(RoutineDataInvalidError);
	});
});
