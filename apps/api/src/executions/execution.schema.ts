import { z } from "zod";
import { LocalDateSchema, RoutineIdSchema } from "../routines/routine.schema.ts";

export const ExecutionRecordIdSchema = z.uuid().brand<"ExecutionRecordId">();

/**
 * 任意の数値。value は 0 を有効な値として扱う（未入力は measurement ごと省略する）。
 * metric・unit は Routine の目標と照合するための名前で、単位換算はしない。
 */
export const MeasurementSchema = z.object({
	metric: z.string().trim().min(1).max(100),
	value: z.number().finite(),
	unit: z.string().trim().min(1).max(30),
});

/** 登録時にクライアントが指定する項目。id・localDate・createdAt はサーバーが決める。 */
export const ExecutionRecordInputSchema = z.object({
	routineId: RoutineIdSchema,
	performedAt: z.iso.datetime({ offset: true }),
	measurement: MeasurementSchema.optional(),
});

/** 1 レコード = 1 回の実施。同日・同 Routine に複数あってよい。 */
export const ExecutionRecordSchema = z.object({
	id: ExecutionRecordIdSchema,
	routineId: RoutineIdSchema,
	/** UTC 表記に正規化した実施日時。 */
	performedAt: z.iso.datetime(),
	/** 登録時の Routine のタイムゾーンで評価した実施日。 */
	localDate: LocalDateSchema,
	measurement: MeasurementSchema.optional(),
	createdAt: z.iso.datetime(),
});

export type ExecutionRecordId = z.infer<typeof ExecutionRecordIdSchema>;
export type Measurement = z.infer<typeof MeasurementSchema>;
export type ExecutionRecordInput = z.infer<typeof ExecutionRecordInputSchema>;
export type ExecutionRecord = z.infer<typeof ExecutionRecordSchema>;
