import type { LocalDate } from "../../routines/routine.schema.ts";

export type NotionProperties = Record<string, unknown>;

export type NotionPageList = {
	results: unknown[];
	hasMore: boolean;
	nextCursor: string | null;
};

/**
 * 実施記録用データソースへのアクセス口。実際の Notion API クライアント（#11）はこれを実装する。
 * 失敗（API エラー・レート制限）は例外として投げる。
 */
export abstract class ExecutionNotionClient {
	abstract createPage(properties: NotionProperties): Promise<unknown>;
	/** Local Date が `date` に等しいページを取得する。 */
	abstract queryByLocalDate(date: LocalDate, startCursor?: string): Promise<NotionPageList>;
}

/** Notion クライアント（#11）が組み込まれるまでの既定実装。保存・取得は常に失敗する。 */
export class UnconfiguredExecutionNotionClient extends ExecutionNotionClient {
	createPage(): Promise<unknown> {
		return Promise.reject(new Error("Notion client is not configured"));
	}
	queryByLocalDate(): Promise<NotionPageList> {
		return Promise.reject(new Error("Notion client is not configured"));
	}
}
