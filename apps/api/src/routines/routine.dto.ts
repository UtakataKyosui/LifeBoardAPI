import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { LocalDateSchema, RoutineIdSchema, RoutineInputSchema, RoutineSchema } from "./routine.schema.ts";

export class RoutineInputDto extends createZodDto(RoutineInputSchema) {}
export class RoutineDto extends createZodDto(RoutineSchema) {}

export class RoutineListDto extends createZodDto(z.object({ items: z.array(RoutineSchema) })) {}

export class ScheduleQueryDto extends createZodDto(z.object({ date: LocalDateSchema.optional() })) {}

export class ScheduleResponseDto extends createZodDto(
	z.object({
		occurrences: z.array(
			z.object({
				occurrenceKey: z.string(),
				routineId: RoutineIdSchema,
				scheduledDate: LocalDateSchema,
			}),
		),
	}),
) {}
