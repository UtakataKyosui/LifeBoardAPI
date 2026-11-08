import { Injectable } from "@nestjs/common";
import { AdjustmentNotionClient } from "../adjustments/notion/notion-adjustment-client.ts";
import { ExecutionNotionClient } from "../executions/notion/notion-execution-client.ts";
import type { LocalDate } from "../routines/routine.schema.ts";
import { NotionRoutineClient } from "../routines/notion/notion-routine-client.ts";
import type { NotionPageList, NotionProperties } from "../routines/notion/notion-routine-client.ts";
import { NotionApiClient } from "./notion-api.client.ts";

/** 各ドメインの client 抽象を、1 つのデータソースに対する NotionApiClient 呼び出しで実装する。 */
@Injectable()
export class RoutineNotionApiAdapter extends NotionRoutineClient {
	constructor(private readonly api: NotionApiClient, private readonly dataSourceId: string) {
		super();
	}
	createPage(properties: NotionProperties): Promise<unknown> {
		return this.api.createPage(this.dataSourceId, properties);
	}
	queryPages(startCursor?: string): Promise<NotionPageList> {
		return this.api.queryDataSource(this.dataSourceId, { startCursor });
	}
}

export class ExecutionNotionApiAdapter extends ExecutionNotionClient {
	constructor(private readonly api: NotionApiClient, private readonly dataSourceId: string) {
		super();
	}
	createPage(properties: NotionProperties): Promise<unknown> {
		return this.api.createPage(this.dataSourceId, properties);
	}
	queryByLocalDate(date: LocalDate, startCursor?: string): Promise<NotionPageList> {
		return this.api.queryDataSource(this.dataSourceId, {
			filter: { property: "Local Date", rich_text: { equals: date } },
			startCursor,
		});
	}
}

export class AdjustmentNotionApiAdapter extends AdjustmentNotionClient {
	constructor(private readonly api: NotionApiClient, private readonly dataSourceId: string) {
		super();
	}
	createPage(properties: NotionProperties): Promise<unknown> {
		return this.api.createPage(this.dataSourceId, properties);
	}
	queryPages(startCursor?: string): Promise<NotionPageList> {
		return this.api.queryDataSource(this.dataSourceId, { startCursor });
	}
}
