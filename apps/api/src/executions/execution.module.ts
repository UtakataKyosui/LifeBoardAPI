import { Module } from "@nestjs/common";
import { RoutineModule } from "../routines/routine.module.ts";
import { ExecutionController } from "./execution.controller.ts";
import { ExecutionRepository } from "./execution.repository.ts";
import { ExecutionService } from "./execution.service.ts";
import { ExecutionNotionClient, UnconfiguredExecutionNotionClient } from "./notion/notion-execution-client.ts";
import { NotionExecutionRepository } from "./notion/notion-execution.repository.ts";

@Module({
	imports: [RoutineModule],
	controllers: [ExecutionController],
	providers: [
		ExecutionService,
		{ provide: ExecutionRepository, useClass: NotionExecutionRepository },
		{ provide: ExecutionNotionClient, useClass: UnconfiguredExecutionNotionClient },
	],
})
export class ExecutionModule {}
