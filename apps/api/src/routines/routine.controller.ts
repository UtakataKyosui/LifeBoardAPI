import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ZodSerializerDto } from "nestjs-zod";
import {
	RoutineDto,
	RoutineInputDto,
	RoutineListDto,
	ScheduleQueryDto,
	ScheduleResponseDto,
} from "./routine.dto.ts";
import { RoutineService } from "./routine.service.ts";

@ApiTags("routines")
@Controller("routines")
export class RoutineController {
	constructor(private readonly routines: RoutineService) {}

	@Post()
	@ApiCreatedResponse({ type: RoutineDto.Output })
	@ZodSerializerDto(RoutineDto)
	create(@Body() body: RoutineInputDto) {
		return this.routines.create(body);
	}

	@Get()
	@ApiOkResponse({ type: RoutineListDto.Output })
	@ZodSerializerDto(RoutineListDto)
	list() {
		return this.routines.list();
	}

	@Get("schedule")
	@ApiOkResponse({ type: ScheduleResponseDto.Output })
	@ZodSerializerDto(ScheduleResponseDto)
	schedule(@Query() query: ScheduleQueryDto) {
		return this.routines.scheduleFor(query.date);
	}
}
