import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { occurrencesOn } from "./occurrence.ts";
import { RoutineDataInvalidError, RoutineRepository, RoutineStorageError } from "./routine.repository.ts";
import type { LocalDate, Routine, RoutineId, RoutineInput } from "./routine.schema.ts";

@Injectable()
export class RoutineService {
	private readonly logger = new Logger(RoutineService.name);

	constructor(private readonly routines: RoutineRepository) {}

	create(input: RoutineInput): Promise<Routine> {
		const now = new Date().toISOString();
		return this.guard(() =>
			this.routines.save({
				...input,
				id: crypto.randomUUID() as RoutineId,
				status: "active",
				revision: 1,
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	async list(): Promise<{ items: Routine[] }> {
		return { items: await this.guard(() => this.routines.listAll()) };
	}

	async scheduleFor(date: LocalDate | undefined) {
		const { items } = await this.list();
		return { occurrences: occurrencesOn(items, date ? { date } : { now: new Date() }) };
	}

	/** 保存先の失敗を 502 にする。原因（個人データを含み得る）は応答にもログにも出さない。 */
	private async guard<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			if (error instanceof RoutineStorageError || error instanceof RoutineDataInvalidError) {
				this.logger.error(`${error.name}: ${error.message}`);
				throw new BadGatewayException(error.name);
			}
			throw error;
		}
	}
}
