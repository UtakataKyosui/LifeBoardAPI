import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { LocalDateSchema, RoutineIdSchema } from "../routines/routine.schema.ts";
import { AdjustmentIdSchema, AdjustmentSchema, PostponeInputSchema, SkipInputSchema } from "./adjustment.schema.ts";

export class SkipInputDto extends createZodDto(SkipInputSchema) {}
export class PostponeInputDto extends createZodDto(PostponeInputSchema) {}
export class AdjustmentDto extends createZodDto(AdjustmentSchema) {}
export class AdjustmentIdParamDto extends createZodDto(z.object({ id: AdjustmentIdSchema })) {}

/** date を指定すると、scheduledDate または postponedTo がその日の調整だけ返す。 */
export class AdjustmentListQueryDto extends createZodDto(z.object({ date: LocalDateSchema.optional() })) {}
export class AdjustmentListDto extends createZodDto(z.object({ items: z.array(AdjustmentSchema) })) {}

export class AdjustedScheduleQueryDto extends createZodDto(z.object({ date: LocalDateSchema })) {}
export class AdjustedScheduleDto extends createZodDto(
	z.object({
		date: LocalDateSchema,
		occurrences: z.array(
			z.object({
				occurrenceKey: z.string(),
				routineId: RoutineIdSchema,
				scheduledDate: LocalDateSchema,
				status: z.enum(["pending", "skipped", "postponed"]),
				adjustmentId: AdjustmentIdSchema.optional(),
				postponedTo: LocalDateSchema.optional(),
				postponedFrom: LocalDateSchema.optional(),
			}),
		),
	}),
) {}
