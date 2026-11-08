import type { LocalDate } from "../routines/routine.schema.ts";
import type { ExecutionRecord } from "./execution.schema.ts";

export abstract class ExecutionRepository {
	/** 保存先が確認するまで resolve しない。失敗時は ExecutionStorageError を投げる。 */
	abstract save(record: ExecutionRecord): Promise<ExecutionRecord>;
	/** 指定した実施日（localDate）の全レコードを取得する。不正データは ExecutionDataInvalidError。 */
	abstract listByLocalDate(date: LocalDate): Promise<ExecutionRecord[]>;
	/** `from` から `to`（両端を含む）の実施日の全レコードを取得する。 */
	abstract listByLocalDateRange(from: LocalDate, to: LocalDate): Promise<ExecutionRecord[]>;
}

/** 保存先との通信失敗・レート制限・未設定。 */
export class ExecutionStorageError extends Error {
	override name = "ExecutionStorageError";
}

/** 保存先から返ったデータがスキーマに合わない。 */
export class ExecutionDataInvalidError extends Error {
	override name = "ExecutionDataInvalidError";
}
