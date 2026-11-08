import { Module } from "@nestjs/common";
import { ExecutionNotionApiAdapter } from "../notion/notion-clients.ts";
import { resolveNotion } from "../notion/notion-config.ts";
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
		{
			provide: ExecutionNotionClient,
			useFactory: () => {
				const notion = resolveNotion("execution");
				return notion ? new ExecutionNotionApiAdapter(notion.api, notion.dataSourceId) : new UnconfiguredExecutionNotionClient();
			},
		},
	],
})
export class ExecutionModule {}
