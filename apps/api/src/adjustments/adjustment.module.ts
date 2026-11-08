import { Module } from "@nestjs/common";
import { AdjustmentNotionApiAdapter } from "../notion/notion-clients.ts";
import { resolveNotion } from "../notion/notion-config.ts";
import { RoutineModule } from "../routines/routine.module.ts";
import { AdjustmentController } from "./adjustment.controller.ts";
import { AdjustmentRepository } from "./adjustment.repository.ts";
import { AdjustmentService } from "./adjustment.service.ts";
import { AdjustmentNotionClient, UnconfiguredAdjustmentNotionClient } from "./notion/notion-adjustment-client.ts";
import { NotionAdjustmentRepository } from "./notion/notion-adjustment.repository.ts";

@Module({
	imports: [RoutineModule],
	controllers: [AdjustmentController],
	providers: [
		AdjustmentService,
		{ provide: AdjustmentRepository, useClass: NotionAdjustmentRepository },
		{
			provide: AdjustmentNotionClient,
			useFactory: () => {
				const notion = resolveNotion("adjustment");
				return notion ? new AdjustmentNotionApiAdapter(notion.api, notion.dataSourceId) : new UnconfiguredAdjustmentNotionClient();
			},
		},
	],
})
export class AdjustmentModule {}
