import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ZodSerializerDto } from "nestjs-zod";
import {
	DailySummaryResponseDto,
	WeeklySummaryResponseDto,
	DateQueryDto,
	ExecutionRecordDto,
	ExecutionRecordInputDto,
	ExecutionRecordListDto,
} from "./execution.dto.ts";
import { ExecutionService } from "./execution.service.ts";

@ApiTags("execution-records")
@Controller("execution-records")
export class ExecutionController {
	constructor(private readonly executions: ExecutionService) {}

	@Post()
	@ApiCreatedResponse({ type: ExecutionRecordDto.Output })
	@ZodSerializerDto(ExecutionRecordDto)
	create(@Body() body: ExecutionRecordInputDto) {
		return this.executions.create(body);
	}

	@Get()
	@ApiOkResponse({ type: ExecutionRecordListDto.Output })
	@ZodSerializerDto(ExecutionRecordListDto)
	listByDate(@Query() query: DateQueryDto) {
		return this.executions.listByDate(query.date);
	}

	@Get("summary")
	@ApiOkResponse({ type: DailySummaryResponseDto.Output })
	@ZodSerializerDto(DailySummaryResponseDto)
	summary(@Query() query: DateQueryDto) {
		return this.executions.summaryFor(query.date);
	}

	@Get("weekly")
	@ApiOkResponse({ type: WeeklySummaryResponseDto.Output })
	@ZodSerializerDto(WeeklySummaryResponseDto)
	weekly(@Query() query: DateQueryDto) {
		return this.executions.weeklySummaryFor(query.date);
	}
}
