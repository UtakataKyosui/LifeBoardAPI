import { describe, expect, it, vi } from "vitest";
import { NotionApiClient, NotionApiError, NOTION_API_VERSION } from "../../src/notion/notion-api.client.ts";
import type { NotionFetch } from "../../src/notion/notion-api.client.ts";
import { ExecutionNotionApiAdapter } from "../../src/notion/notion-clients.ts";
import { resolveNotion } from "../../src/notion/notion-config.ts";

const res = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
	ok: status >= 200 && status < 300,
	status,
	headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
	json: async () => body,
});

function make(responses: ReturnType<typeof res>[]) {
	const calls: { url: string; init: Parameters<NotionFetch>[1] }[] = [];
	const fetch: NotionFetch = async (url, init) => {
		calls.push({ url, init });
		const r = responses.shift();
		if (!r) throw new Error("no response");
		return r;
	};
	const sleep = vi.fn(async () => {});
	return { client: new NotionApiClient({ token: "secret-token", fetch, sleep }), calls, sleep };
}

describe("NotionApiClient", () => {
	it("認証・バージョンヘッダー付きでデータソース配下にページを作る", async () => {
		const { client, calls } = make([res(200, { id: "p1" })]);
		await expect(client.createPage("ds1", { A: 1 })).resolves.toEqual({ id: "p1" });
		expect(calls[0]!.url).toBe("https://api.notion.com/v1/pages");
		expect(calls[0]!.init.headers.Authorization).toBe("Bearer secret-token");
		expect(calls[0]!.init.headers["Notion-Version"]).toBe(NOTION_API_VERSION);
		expect(JSON.parse(calls[0]!.init.body!)).toEqual({
			parent: { type: "data_source_id", data_source_id: "ds1" },
			properties: { A: 1 },
		});
	});

	it("一覧を検索し、カーソルとフィルターを渡す", async () => {
		const { client, calls } = make([res(200, { results: [{ id: 1 }], has_more: true, next_cursor: "c2" })]);
		const list = await client.queryDataSource("ds1", { filter: { f: 1 }, startCursor: "c1" });
		expect(list).toEqual({ results: [{ id: 1 }], hasMore: true, nextCursor: "c2" });
		expect(calls[0]!.url).toBe("https://api.notion.com/v1/data_sources/ds1/query");
		expect(JSON.parse(calls[0]!.init.body!)).toMatchObject({ filter: { f: 1 }, start_cursor: "c1" });
	});

	it("形式の不正な一覧応答を拒否する", async () => {
		const { client } = make([res(200, { results: "x", has_more: false })]);
		await expect(client.queryDataSource("ds1")).rejects.toBeInstanceOf(NotionApiError);
	});

	it("429 は Retry-After に従って再試行し、成功すれば結果を返す", async () => {
		const { client, sleep } = make([res(429, { code: "rate_limited" }, { "retry-after": "2" }), res(200, { id: "p1" })]);
		await expect(client.createPage("ds1", {})).resolves.toEqual({ id: "p1" });
		expect(sleep).toHaveBeenCalledWith(2000);
	});

	it("再試行を使い切ったら状態コードとエラーコードだけを含む例外にする", async () => {
		const { client } = make([429, 429, 429].map(() => res(429, { code: "rate_limited", message: "個人データ" })));
		const error = await client.createPage("ds1", {}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NotionApiError);
		expect((error as NotionApiError).status).toBe(429);
		expect((error as Error).message).toContain("rate_limited");
		expect((error as Error).message).not.toContain("個人データ");
		expect((error as Error).message).not.toContain("secret-token");
	});

	it("400 系は再試行しない", async () => {
		const { client, calls } = make([res(400, { code: "validation_error" })]);
		await expect(client.createPage("ds1", {})).rejects.toMatchObject({ status: 400, code: "validation_error" });
		expect(calls).toHaveLength(1);
	});

	it("通信エラーはトークンを含まない例外にする", async () => {
		const client = new NotionApiClient({
			token: "secret-token",
			fetch: async () => {
				throw new Error("boom secret-token");
			},
		});
		const error = (await client.createPage("ds1", {}).catch((e: unknown) => e)) as Error;
		expect(error).toBeInstanceOf(NotionApiError);
		expect(error.message).not.toContain("secret-token");
	});
});

describe("実施記録アダプター", () => {
	it("Local Date の一致フィルターで検索する", async () => {
		const { client, calls } = make([res(200, { results: [], has_more: false, next_cursor: null })]);
		await new ExecutionNotionApiAdapter(client, "ds1").queryByLocalDate("2026-11-08" as never);
		expect(JSON.parse(calls[0]!.init.body!).filter).toEqual({
			property: "Local Date",
			rich_text: { equals: "2026-11-08" },
		});
	});
});

describe("resolveNotion", () => {
	it("トークンかデータソース ID が無ければ未設定として扱う", () => {
		expect(resolveNotion("routine", {})).toBeUndefined();
		expect(resolveNotion("routine", { NOTION_TOKEN: "t" })).toBeUndefined();
		expect(resolveNotion("routine", { NOTION_TOKEN: "t", NOTION_ROUTINE_DATA_SOURCE_ID: "d" })?.dataSourceId).toBe("d");
	});
});
