export type NotionProperties = Record<string, unknown>;

export type NotionPageList = {
	results: unknown[];
	hasMore: boolean;
	nextCursor: string | null;
};

/** スキップ・延期用データソースへのアクセス口。実際の Notion API クライアント（#11）が実装する。 */
export abstract class AdjustmentNotionClient {
	abstract createPage(properties: NotionProperties): Promise<unknown>;
	abstract queryPages(startCursor?: string): Promise<NotionPageList>;
}

export class UnconfiguredAdjustmentNotionClient extends AdjustmentNotionClient {
	createPage(): Promise<unknown> {
		return Promise.reject(new Error("Notion client is not configured"));
	}
	queryPages(): Promise<NotionPageList> {
		return Promise.reject(new Error("Notion client is not configured"));
	}
}
