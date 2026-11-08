import { Injectable } from "@nestjs/common";
import { ZodError } from "zod";
import { ExecutionDataInvalidError, ExecutionRepository, ExecutionStorageError } from "../execution.repository.ts";
import { ExecutionNotionClient } from "./notion-execution-client.ts";
import { fromNotionPage, toNotionProperties } from "./execution.mapper.ts";
import { addDays } from "../../routines/calendar.ts";
import type { LocalDate } from "../../routines/routine.schema.ts";
import type { ExecutionRecord } from "../execution.schema.ts";

@Injectable()
export class NotionExecutionRepository extends ExecutionRepository {
	constructor(private readonly client: ExecutionNotionClient) {
		super();
	}

	async save(record: ExecutionRecord): Promise<ExecutionRecord> {
		let page: unknown;
		try {
			page = await this.client.createPage(toNotionProperties(record));
		} catch (cause) {
			throw new ExecutionStorageError("実施記録の保存に失敗しました", { cause });
		}
		// Notion の応答を検証できて初めて保存成功とみなす。
		return this.parse(page);
	}

	async listByLocalDate(date: LocalDate): Promise<ExecutionRecord[]> {
		const records: ExecutionRecord[] = [];
		let cursor: string | undefined;
		do {
			let list;
			try {
				list = await this.client.queryByLocalDate(date, cursor);
			} catch (cause) {
				throw new ExecutionStorageError("実施記録の取得に失敗しました", { cause });
			}
			for (const page of list.results) {
				const record = this.parse(page);
				// 保存先の絞り込みに頼らず、隣接日の混入をここで排除する。
				if (record.localDate === date) records.push(record);
			}
			if (list.hasMore && !list.nextCursor) {
				throw new ExecutionDataInvalidError("次ページがあるのにカーソルがありません");
			}
			cursor = list.hasMore ? (list.nextCursor ?? undefined) : undefined;
		} while (cursor);
		return records;
	}

	/** Local Date は文字列プロパティで範囲検索できないため、日ごとに取得して連結する（最大 7 回）。 */
	async listByLocalDateRange(from: LocalDate, to: LocalDate): Promise<ExecutionRecord[]> {
		const records: ExecutionRecord[] = [];
		for (let date = from; date <= to; date = addDays(date, 1)) {
			records.push(...(await this.listByLocalDate(date)));
		}
		return records;
	}

	private parse(page: unknown): ExecutionRecord {
		try {
			return fromNotionPage(page);
		} catch (cause) {
			if (cause instanceof ZodError) {
				const paths = cause.issues.map((issue) => issue.path.join(".")).join(", ");
				throw new ExecutionDataInvalidError(`Notion の実施記録データが不正です: ${paths}`, { cause });
			}
			throw cause;
		}
	}
}
