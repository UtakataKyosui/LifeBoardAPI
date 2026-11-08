import { Injectable } from "@nestjs/common";
import { ZodError } from "zod";
import { AdjustmentDataInvalidError, AdjustmentRepository, AdjustmentStorageError } from "../adjustment.repository.ts";
import { fromNotionPage, toNotionProperties } from "./adjustment.mapper.ts";
import { AdjustmentNotionClient } from "./notion-adjustment-client.ts";
import type { Adjustment } from "../adjustment.schema.ts";

@Injectable()
export class NotionAdjustmentRepository extends AdjustmentRepository {
	constructor(private readonly client: AdjustmentNotionClient) {
		super();
	}

	async save(adjustment: Adjustment): Promise<Adjustment> {
		let page: unknown;
		try {
			page = await this.client.createPage(toNotionProperties(adjustment));
		} catch (cause) {
			throw new AdjustmentStorageError("調整の保存に失敗しました", { cause });
		}
		return this.parse(page);
	}

	async listAll(): Promise<Adjustment[]> {
		const items: Adjustment[] = [];
		let cursor: string | undefined;
		do {
			let list;
			try {
				list = await this.client.queryPages(cursor);
			} catch (cause) {
				throw new AdjustmentStorageError("調整の取得に失敗しました", { cause });
			}
			items.push(...list.results.map((page) => this.parse(page)));
			if (list.hasMore && !list.nextCursor) {
				throw new AdjustmentDataInvalidError("次ページがあるのにカーソルがありません");
			}
			cursor = list.hasMore ? (list.nextCursor ?? undefined) : undefined;
		} while (cursor);
		return items;
	}

	private parse(page: unknown): Adjustment {
		try {
			return fromNotionPage(page);
		} catch (cause) {
			if (cause instanceof ZodError) {
				const paths = cause.issues.map((issue) => issue.path.join(".")).join(", ");
				throw new AdjustmentDataInvalidError(`Notion の調整データが不正です: ${paths}`, { cause });
			}
			throw cause;
		}
	}
}
