import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ZodSerializerDto } from "nestjs-zod";
import { HealthResponseDto } from "./health.schema.ts";
import { HealthService } from "./health.service.ts";

@ApiTags("health")
@Controller("health")
export class HealthController {
	constructor(private readonly health: HealthService) {}

	@Get()
	@ApiOkResponse({ type: HealthResponseDto })
	@ZodSerializerDto(HealthResponseDto)
	check() {
		return this.health.check();
	}
}
