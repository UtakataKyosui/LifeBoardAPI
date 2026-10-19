import { Injectable } from "@nestjs/common";
import { ZodError } from "zod";
import { RoutineDataInvalidError, RoutineRepository, RoutineStorageError } from "../routine.repository.ts";
import { NotionRoutineClient } from "./notion-routine-client.ts";
import { fromNotionPage, toNotionProperties } from "./routine.mapper.ts";
import type { Routine } from "../routine.schema.ts";

@Injectable()
export class NotionRoutineRepository extends RoutineRepository {
	constructor(private readonly client: NotionRoutineClient) {
		super();
	}

	async save(routine: Routine): Promise<Routine> {
		let page: unknown;
		try {
			page = await this.client.createPage(toNotionProperties(routine));
		} catch (cause) {
			throw new RoutineStorageError("Routine の保存に失敗しました", { cause });
		}
		// Notion の応答を検証できて初めて保存成功とみなす。
		return this.parse(page);
	}

	async listAll(): Promise<Routine[]> {
		const routines: Routine[] = [];
		let cursor: string | undefined;
		do {
			let list;
			try {
				list = await this.client.queryPages(cursor);
			} catch (cause) {
				throw new RoutineStorageError("Routine の取得に失敗しました", { cause });
			}
			routines.push(...list.results.map((page) => this.parse(page)));
			if (list.hasMore && !list.nextCursor) {
				throw new RoutineDataInvalidError("次ページがあるのにカーソルがありません");
			}
			cursor = list.hasMore ? (list.nextCursor ?? undefined) : undefined;
		} while (cursor);
		return routines;
	}

	private parse(page: unknown): Routine {
		try {
			return fromNotionPage(page);
		} catch (cause) {
			if (cause instanceof ZodError) {
				// ページ内容は個人データを含み得るため、検証エラーの項目パスだけを残す。
				const paths = cause.issues.map((issue) => issue.path.join(".")).join(", ");
				throw new RoutineDataInvalidError(`Notion の Routine データが不正です: ${paths}`, { cause });
			}
			throw cause;
		}
	}
}
