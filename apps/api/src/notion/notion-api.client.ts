import type { NotionPageList, NotionProperties } from "../routines/notion/notion-routine-client.ts";

export const NOTION_API_BASE = "https://api.notion.com/v1";
export const NOTION_API_VERSION = "2025-09-03";

export type NotionFetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
	ok: boolean;
	status: number;
	headers: { get(name: string): string | null };
	json(): Promise<unknown>;
}>;

export type NotionApiClientOptions = {
	token: string;
	fetch?: NotionFetch;
	sleep?: (ms: number) => Promise<void>;
	/** 429 / 5xx の再試行回数（初回を除く）。既定 2。 */
	maxRetries?: number;
	/** Retry-After が無いときの待機の基準（ms）。 */
	baseDelayMs?: number;
};

/** Notion API の失敗。メッセージには状態コードとエラーコードのみを含め、本文・トークンは含めない。 */
export class NotionApiError extends Error {
	constructor(
		message: string,
		readonly status: number | null,
		readonly code: string | null,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "NotionApiError";
	}
}

const MAX_RETRY_DELAY_MS = 10_000;
const retryable = (status: number) => status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

/** Notion API への低レベルアクセス。認証、エラー、レート制限（429 の再試行）を扱う。 */
export class NotionApiClient {
	private readonly fetchImpl: NotionFetch;
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly maxRetries: number;
	private readonly baseDelayMs: number;
	private readonly token: string;

	constructor(options: NotionApiClientOptions) {
		if (!options.token) throw new Error("Notion token is required");
		this.token = options.token;
		this.fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
		this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
		this.maxRetries = options.maxRetries ?? 2;
		this.baseDelayMs = options.baseDelayMs ?? 500;
	}

	/** データソース配下にページを作成し、Notion が返したページを返す。 */
	createPage(dataSourceId: string, properties: NotionProperties): Promise<unknown> {
		return this.request("/pages", {
			parent: { type: "data_source_id", data_source_id: dataSourceId },
			properties,
		});
	}

	/** データソースを 1 ページ分検索する。 */
	async queryDataSource(dataSourceId: string, query: { filter?: unknown; startCursor?: string } = {}): Promise<NotionPageList> {
		const body: Record<string, unknown> = { page_size: 100 };
		if (query.filter) body.filter = query.filter;
		if (query.startCursor) body.start_cursor = query.startCursor;
		const res = await this.request(`/data_sources/${encodeURIComponent(dataSourceId)}/query`, body);
		return parseList(res);
	}

	private async request(path: string, body: unknown): Promise<unknown> {
		for (let attempt = 0; ; attempt++) {
			let res;
			try {
				res = await this.fetchImpl(`${NOTION_API_BASE}${path}`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.token}`,
						"Notion-Version": NOTION_API_VERSION,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(body),
				});
			} catch (cause) {
				// 通信エラーの cause には URL 等しか含まれないが、念のためメッセージは固定にする。
				throw new NotionApiError("Notion API への接続に失敗しました", null, null, { cause });
			}
			if (res.ok) {
				try {
					return await res.json();
				} catch (cause) {
					throw new NotionApiError("Notion API の応答が JSON ではありません", res.status, null, { cause });
				}
			}
			if (retryable(res.status) && attempt < this.maxRetries) {
				await this.sleep(this.delay(res, attempt));
				continue;
			}
			// 本文は一度しか読めないため、エラーコードは 1 回だけ取り出して使い回す。
			const code = await errorCode(res);
			throw new NotionApiError(`Notion API がエラーを返しました (status ${res.status}, code ${code})`, res.status, code);
		}
	}

	private delay(res: { headers: { get(name: string): string | null } }, attempt: number): number {
		const retryAfter = Number(res.headers.get("retry-after"));
		const ms = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : this.baseDelayMs * 2 ** attempt;
		return Math.min(ms, MAX_RETRY_DELAY_MS);
	}
}

async function errorCode(res: { json(): Promise<unknown> }): Promise<string | null> {
	try {
		const body = (await res.json()) as { code?: unknown };
		return typeof body.code === "string" ? body.code : null;
	} catch {
		return null;
	}
}

/** 一覧応答の形（results / has_more / next_cursor）を検証する。各ページの中身は mapper が検証する。 */
function parseList(res: unknown): NotionPageList {
	const r = res as { results?: unknown; has_more?: unknown; next_cursor?: unknown } | null;
	if (!r || !Array.isArray(r.results) || typeof r.has_more !== "boolean") {
		throw new NotionApiError("Notion API の一覧応答の形式が不正です", null, null);
	}
	if (r.next_cursor !== null && r.next_cursor !== undefined && typeof r.next_cursor !== "string") {
		throw new NotionApiError("Notion API の一覧応答の形式が不正です", null, null);
	}
	return { results: r.results, hasMore: r.has_more, nextCursor: (r.next_cursor as string | null | undefined) ?? null };
}
