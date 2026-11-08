export type NotionProperties = Record<string, unknown>;

export type NotionPageList = {
	results: unknown[];
	hasMore: boolean;
	nextCursor: string | null;
};

/**
 * Routine 用データソースへのアクセス口。実際の Notion API クライアント（#11）はこれを実装する。
 * 失敗（API エラー・レート制限）は例外として投げる。
 */
export abstract class NotionRoutineClient {
	abstract createPage(properties: NotionProperties): Promise<unknown>;
	abstract queryPages(startCursor?: string): Promise<NotionPageList>;
}

/** Notion クライアント（#11）が組み込まれるまでの既定実装。保存・取得は常に失敗する。 */
export class UnconfiguredNotionRoutineClient extends NotionRoutineClient {
	createPage(): Promise<unknown> {
		return Promise.reject(new Error("Notion client is not configured"));
	}
	queryPages(): Promise<NotionPageList> {
		return Promise.reject(new Error("Notion client is not configured"));
	}
}
