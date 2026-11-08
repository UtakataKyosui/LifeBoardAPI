import { Module } from "@nestjs/common";
import { RoutineNotionApiAdapter } from "../notion/notion-clients.ts";
import { resolveNotion } from "../notion/notion-config.ts";
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
		{
			provide: NotionRoutineClient,
			useFactory: () => {
				const notion = resolveNotion("routine");
				return notion ? new RoutineNotionApiAdapter(notion.api, notion.dataSourceId) : new UnconfiguredNotionRoutineClient();
			},
		},
	],
	exports: [RoutineRepository],
})
export class RoutineModule {}
