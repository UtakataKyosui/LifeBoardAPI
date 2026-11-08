import { Module } from "@nestjs/common";
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
		{ provide: AdjustmentNotionClient, useClass: UnconfiguredAdjustmentNotionClient },
	],
})
export class AdjustmentModule {}
