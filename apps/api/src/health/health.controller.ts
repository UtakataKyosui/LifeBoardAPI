import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service.ts";

@Controller("health")
export class HealthController {
	constructor(private readonly health: HealthService) {}

	@Get()
	check() {
		return this.health.check();
	}
}
