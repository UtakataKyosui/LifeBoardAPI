import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { LocalDateSchema, RoutineIdSchema } from "../routines/routine.schema.ts";
import { ExecutionRecordInputSchema, ExecutionRecordSchema } from "./execution.schema.ts";

export class ExecutionRecordInputDto extends createZodDto(ExecutionRecordInputSchema) {}
export class ExecutionRecordDto extends createZodDto(ExecutionRecordSchema) {}

export class ExecutionRecordListDto extends createZodDto(z.object({ items: z.array(ExecutionRecordSchema) })) {}

/** date は必須。省略時の「今日」はタイムゾーンが Routine ごとに異なるため定義しない。 */
export class DateQueryDto extends createZodDto(z.object({ date: LocalDateSchema })) {}

export class DailySummaryResponseDto extends createZodDto(
	z.object({
		date: LocalDateSchema,
		summaries: z.array(
			z.object({
				routineId: RoutineIdSchema,
				date: LocalDateSchema,
				executionCount: z.number().int().min(0),
				executed: z.boolean(),
				measurements: z.array(
					z.object({
						metric: z.string(),
						unit: z.string(),
						count: z.number().int().min(1),
						sum: z.number(),
					}),
				),
				targetStatus: z.enum(["achieved", "not_achieved", "no_data", "no_target"]),
			}),
		),
	}),
) {}

export class WeeklySummaryResponseDto extends createZodDto(
	z.object({
		date: LocalDateSchema,
		weekStart: LocalDateSchema,
		weekEnd: LocalDateSchema,
		summaries: z.array(
			z.object({
				routineId: RoutineIdSchema,
				weekStart: LocalDateSchema,
				weekEnd: LocalDateSchema,
				required: z.number().int().min(1),
				executedDays: z.number().int().min(0),
				executionCount: z.number().int().min(0),
				status: z.enum(["achieved", "not_achieved"]),
			}),
		),
	}),
) {}
