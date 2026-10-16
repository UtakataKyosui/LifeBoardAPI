import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.ts";
import { HealthService } from "./health/health.service.ts";

@Module({
	controllers: [HealthController],
	providers: [HealthService],
})
export class AppModule {}
