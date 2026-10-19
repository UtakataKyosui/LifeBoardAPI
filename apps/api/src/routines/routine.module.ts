import { Module } from "@nestjs/common";
import { NotionRoutineClient, UnconfiguredNotionRoutineClient } from "./notion/notion-routine-client.ts";
import { NotionRoutineRepository } from "./notion/notion-routine.repository.ts";
import { RoutineController } from "./routine.controller.ts";
import { RoutineRepository } from "./routine.repository.ts";
import { RoutineService } from "./routine.service.ts";

@Module({
	controllers: [RoutineController],
	providers: [
		RoutineService,
		{ provide: RoutineRepository, useClass: NotionRoutineRepository },
		{ provide: NotionRoutineClient, useClass: UnconfiguredNotionRoutineClient },
	],
})
export class RoutineModule {}
