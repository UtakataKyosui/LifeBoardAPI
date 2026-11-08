import { z } from "zod";
import { LocalDateSchema, RoutineIdSchema } from "../routines/routine.schema.ts";

export const ADJUSTMENT_KINDS = ["skipped", "postponed", "cancelled"] as const;

export const AdjustmentIdSchema = z.uuid().brand<"AdjustmentId">();

const ReasonSchema = z.string().trim().min(1).max(500);

/** スキップ。元の予定日を「やらない」と決めた事実で、実施記録ではない。 */
export const SkipInputSchema = z.object({
	routineId: RoutineIdSchema,
	scheduledDate: LocalDateSchema,
	reason: ReasonSchema.optional(),
});

/** 延期。元の予定日の予定を postponedTo へ移す。 */
export const PostponeInputSchema = SkipInputSchema.extend({
	postponedTo: LocalDateSchema,
});

/**
 * 調整は追記のみのイベント。更新・削除はせず、取消も `cancelled` を追記して表す（履歴を変えない）。
 * - skipped: scheduledDate をスキップ
 * - postponed: scheduledDate の予定を postponedTo へ延期
 * - cancelled: cancelsId の調整を取り消す（scheduledDate・routineId は取り消す対象と同じ）
 */
export const AdjustmentSchema = z
	.object({
		id: AdjustmentIdSchema,
		kind: z.enum(ADJUSTMENT_KINDS),
		routineId: RoutineIdSchema,
		scheduledDate: LocalDateSchema,
		postponedTo: LocalDateSchema.optional(),
		cancelsId: AdjustmentIdSchema.optional(),
		reason: ReasonSchema.optional(),
		createdAt: z.iso.datetime(),
	})
	.superRefine((adjustment, ctx) => {
		const issue = (message: string) => ctx.addIssue({ code: "custom", message });
		if (adjustment.kind === "postponed") {
			if (!adjustment.postponedTo) issue("postponed には postponedTo が必要です");
			else if (adjustment.postponedTo <= adjustment.scheduledDate) issue("postponedTo は scheduledDate より後にしてください");
		} else if (adjustment.postponedTo) {
			issue("postponedTo は postponed でのみ指定できます");
		}
		if (adjustment.kind === "cancelled") {
			if (!adjustment.cancelsId) issue("cancelled には cancelsId が必要です");
		} else if (adjustment.cancelsId) {
			issue("cancelsId は cancelled でのみ指定できます");
		}
	});

export type AdjustmentId = z.infer<typeof AdjustmentIdSchema>;
export type Adjustment = z.infer<typeof AdjustmentSchema>;
export type SkipInput = z.infer<typeof SkipInputSchema>;
export type PostponeInput = z.infer<typeof PostponeInputSchema>;
