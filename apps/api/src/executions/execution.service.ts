import {
	BadGatewayException,
	Injectable,
	Logger,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { localDateOf } from "../routines/occurrence.ts";
import { RoutineDataInvalidError, RoutineRepository, RoutineStorageError } from "../routines/routine.repository.ts";
import { ExecutionDataInvalidError, ExecutionRepository, ExecutionStorageError } from "./execution.repository.ts";
import { summarizeDay } from "./summary.ts";
import type { LocalDate } from "../routines/routine.schema.ts";
import type { ExecutionRecord, ExecutionRecordId, ExecutionRecordInput } from "./execution.schema.ts";

@Injectable()
export class ExecutionService {
	private readonly logger = new Logger(ExecutionService.name);

	constructor(
		private readonly records: ExecutionRepository,
		private readonly routines: RoutineRepository,
	) {}

	async create(input: ExecutionRecordInput): Promise<ExecutionRecord> {
		// Notion に一意制約・トランザクションは無い前提。Routine の存在は保存前に確認するだけで、
		// 同時に重複登録されても防げない（同日・同 Routine の複数登録は仕様上許容）。
		const routine = (await this.guard(() => this.routines.listAll())).find((r) => r.id === input.routineId);
		if (!routine) throw new NotFoundException("Routine が存在しません");

		const { measurement } = input;
		const { target } = routine;
		if (measurement && target && (measurement.metric !== target.metric || measurement.unit !== target.unit)) {
			throw new UnprocessableEntityException("measurement の metric・unit が Routine の目標と一致しません");
		}

		const performedAt = new Date(input.performedAt);
		return this.guard(() =>
			this.records.save({
				id: crypto.randomUUID() as ExecutionRecordId,
				routineId: input.routineId,
				performedAt: performedAt.toISOString(),
				localDate: localDateOf(performedAt, routine.schedule.timeZone),
				measurement,
				createdAt: new Date().toISOString(),
			}),
		);
	}

	async listByDate(date: LocalDate): Promise<{ items: ExecutionRecord[] }> {
		const items = await this.guard(() => this.records.listByLocalDate(date));
		return { items: items.sort((a, b) => a.performedAt.localeCompare(b.performedAt) || a.id.localeCompare(b.id)) };
	}

	async summaryFor(date: LocalDate) {
		const [items, routines] = await Promise.all([
			this.guard(() => this.records.listByLocalDate(date)),
			this.guard(() => this.routines.listAll()),
		]);
		return { date, summaries: summarizeDay(routines, items, date) };
	}

	/** 保存先の失敗を 502 にする。原因（個人データを含み得る）は応答にもログにも出さない。 */
	private async guard<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			if (
				error instanceof ExecutionStorageError ||
				error instanceof ExecutionDataInvalidError ||
				error instanceof RoutineStorageError ||
				error instanceof RoutineDataInvalidError
			) {
				this.logger.error(`${error.name}: ${error.message}`);
				throw new BadGatewayException(error.name);
			}
			throw error;
		}
	}
}
