import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod";
import { HealthController } from "./health/health.controller.ts";
import { HealthService } from "./health/health.service.ts";
import { RoutineModule } from "./routines/routine.module.ts";

@Module({
	imports: [RoutineModule],
	controllers: [HealthController],
	providers: [
		HealthService,
		{ provide: APP_PIPE, useClass: ZodValidationPipe },
		{ provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
	],
})
export class AppModule {}
