import {
	BadGatewayException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { isScheduledOn } from "../routines/occurrence.ts";
import { RoutineDataInvalidError, RoutineRepository, RoutineStorageError } from "../routines/routine.repository.ts";
import { activeAdjustments, adjustedOccurrencesOn } from "./adjust.ts";
import { AdjustmentDataInvalidError, AdjustmentRepository, AdjustmentStorageError } from "./adjustment.repository.ts";
import type { LocalDate, Routine } from "../routines/routine.schema.ts";
import type { Adjustment, AdjustmentId, PostponeInput, SkipInput } from "./adjustment.schema.ts";

@Injectable()
export class AdjustmentService {
	private readonly logger = new Logger(AdjustmentService.name);

	constructor(
		private readonly adjustments: AdjustmentRepository,
		private readonly routines: RoutineRepository,
	) {}

	skip(input: SkipInput): Promise<Adjustment> {
		return this.register("skipped", input);
	}

	postpone(input: PostponeInput): Promise<Adjustment> {
		return this.register("postponed", input);
	}

	/** 元の調整は変更せず、cancelled を追記する。 */
	async cancel(id: AdjustmentId): Promise<Adjustment> {
		const all = await this.guard(() => this.adjustments.listAll());
		const target = all.find((a) => a.id === id);
		if (!target) throw new NotFoundException("調整が存在しません");
		if (target.kind === "cancelled") throw new UnprocessableEntityException("取消は取り消せません");
		if (!activeAdjustments(all).some((a) => a.id === id)) throw new ConflictException("すでに取り消されています");
		return this.guard(() =>
			this.adjustments.save({
				id: crypto.randomUUID() as AdjustmentId,
				kind: "cancelled",
				routineId: target.routineId,
				scheduledDate: target.scheduledDate,
				cancelsId: target.id,
				createdAt: new Date().toISOString(),
			}),
		);
	}

	async list(date: LocalDate | undefined): Promise<{ items: Adjustment[] }> {
		const all = await this.guard(() => this.adjustments.listAll());
		const items = date ? all.filter((a) => a.scheduledDate === date || a.postponedTo === date) : all;
		return { items: items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) };
	}

	async scheduleFor(date: LocalDate) {
		const [routines, adjustments] = await Promise.all([
			this.guard(() => this.routines.listAll()),
			this.guard(() => this.adjustments.listAll()),
		]);
		return { date, occurrences: adjustedOccurrencesOn(routines, adjustments, date) };
	}

	private async register(kind: "skipped" | "postponed", input: SkipInput & { postponedTo?: LocalDate }): Promise<Adjustment> {
		// Notion に一意制約・トランザクションは無い前提。確認と保存の間の競合は防げない。
		const [routines, all] = await Promise.all([
			this.guard(() => this.routines.listAll()),
			this.guard(() => this.adjustments.listAll()),
		]);
		const routine = routines.find((r) => r.id === input.routineId);
		if (!routine) throw new NotFoundException("Routine が存在しません");
		this.assertAdjustable(routine, input.scheduledDate);

		const mine = activeAdjustments(all).filter((a) => a.routineId === routine.id);
		if (mine.some((a) => a.scheduledDate === input.scheduledDate)) {
			throw new ConflictException("この予定にはすでに有効なスキップまたは延期があります");
		}
		if (kind === "postponed") {
			const to = input.postponedTo as LocalDate;
			if (to <= input.scheduledDate) throw new UnprocessableEntityException("postponedTo は scheduledDate より後にしてください");
			if (isScheduledOn(routine.schedule, to)) {
				throw new ConflictException("延期先にはすでにこの Routine の予定があります");
			}
			if (mine.some((a) => a.kind === "postponed" && a.postponedTo === to)) {
				throw new ConflictException("延期先にはすでに別の延期が入っています");
			}
		}

		return this.guard(() =>
			this.adjustments.save({
				id: crypto.randomUUID() as AdjustmentId,
				kind,
				routineId: input.routineId,
				scheduledDate: input.scheduledDate,
				postponedTo: kind === "postponed" ? input.postponedTo : undefined,
				reason: input.reason,
				createdAt: new Date().toISOString(),
			}),
		);
	}

	private assertAdjustable(routine: Routine, scheduledDate: LocalDate) {
		if (routine.status !== "active") throw new UnprocessableEntityException("archived の Routine は調整できません");
		if (!isScheduledOn(routine.schedule, scheduledDate)) {
			throw new UnprocessableEntityException("scheduledDate はこの Routine の予定日ではありません");
		}
	}

	/** 保存先の失敗を 502 にする。原因（個人データを含み得る）は応答にもログにも出さない。 */
	private async guard<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			if (
				error instanceof AdjustmentStorageError ||
				error instanceof AdjustmentDataInvalidError ||
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
