import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ZodSerializerDto } from "nestjs-zod";
import {
	AdjustedScheduleDto,
	AdjustedScheduleQueryDto,
	AdjustmentDto,
	AdjustmentIdParamDto,
	AdjustmentListDto,
	AdjustmentListQueryDto,
	PostponeInputDto,
	SkipInputDto,
} from "./adjustment.dto.ts";
import { AdjustmentService } from "./adjustment.service.ts";

@ApiTags("occurrence-adjustments")
@Controller("occurrence-adjustments")
export class AdjustmentController {
	constructor(private readonly adjustments: AdjustmentService) {}

	@Post("skip")
	@ApiCreatedResponse({ type: AdjustmentDto.Output })
	@ZodSerializerDto(AdjustmentDto)
	skip(@Body() body: SkipInputDto) {
		return this.adjustments.skip(body);
	}

	@Post("postpone")
	@ApiCreatedResponse({ type: AdjustmentDto.Output })
	@ZodSerializerDto(AdjustmentDto)
	postpone(@Body() body: PostponeInputDto) {
		return this.adjustments.postpone(body);
	}

	@Post(":id/cancel")
	@ApiCreatedResponse({ type: AdjustmentDto.Output })
	@ZodSerializerDto(AdjustmentDto)
	cancel(@Param() params: AdjustmentIdParamDto) {
		return this.adjustments.cancel(params.id);
	}

	@Get()
	@ApiOkResponse({ type: AdjustmentListDto.Output })
	@ZodSerializerDto(AdjustmentListDto)
	list(@Query() query: AdjustmentListQueryDto) {
		return this.adjustments.list(query.date);
	}

	@Get("schedule")
	@ApiOkResponse({ type: AdjustedScheduleDto.Output })
	@ZodSerializerDto(AdjustedScheduleDto)
	schedule(@Query() query: AdjustedScheduleQueryDto) {
		return this.adjustments.scheduleFor(query.date);
	}
}
