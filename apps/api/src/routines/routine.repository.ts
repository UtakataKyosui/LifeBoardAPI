import type { Routine } from "./routine.schema.ts";

export abstract class RoutineRepository {
	/** 保存先が確認するまで resolve しない。失敗時は RoutineStorageError を投げる。 */
	abstract save(routine: Routine): Promise<Routine>;
	/** 全ページを取得する。外部データが不正なら RoutineDataInvalidError を投げる。 */
	abstract listAll(): Promise<Routine[]>;
}

/** 保存先との通信失敗・レート制限・未設定。 */
export class RoutineStorageError extends Error {
	override name = "RoutineStorageError";
}

/** 保存先から返ったデータがスキーマに合わない。 */
export class RoutineDataInvalidError extends Error {
	override name = "RoutineDataInvalidError";
}
