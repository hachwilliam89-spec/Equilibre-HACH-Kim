import { Inject, Injectable } from '@nestjs/common';
import { MEASUREMENT_REPOSITORY } from '../../domain/ports/measurement-repository.port';
import type { MeasurementRepositoryPort } from '../../domain/ports/measurement-repository.port';

@Injectable()
export class GetMeasurementHistoryUseCase {
  constructor(
    @Inject(MEASUREMENT_REPOSITORY)
    private readonly repository: MeasurementRepositoryPort,
  ) {}

  execute(authenticatedUserId: string) {
    return this.repository.findHistoryByUserId(authenticatedUserId);
  }
}
