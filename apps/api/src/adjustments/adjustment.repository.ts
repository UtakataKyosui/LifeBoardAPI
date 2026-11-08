import type { Adjustment } from "./adjustment.schema.ts";

/** 追記のみ。更新・削除は提供しない。 */
export abstract class AdjustmentRepository {
	/** 保存先が確認するまで resolve しない。失敗時は AdjustmentStorageError を投げる。 */
	abstract save(adjustment: Adjustment): Promise<Adjustment>;
	/** 全イベント（cancelled を含む）を取得する。不正データは AdjustmentDataInvalidError。 */
	abstract listAll(): Promise<Adjustment[]>;
}

export class AdjustmentStorageError extends Error {
	override name = "AdjustmentStorageError";
}

export class AdjustmentDataInvalidError extends Error {
	override name = "AdjustmentDataInvalidError";
}
