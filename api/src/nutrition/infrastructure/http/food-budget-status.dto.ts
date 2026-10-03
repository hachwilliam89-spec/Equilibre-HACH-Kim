import { ApiProperty } from '@nestjs/swagger';
import type { FoodBudgetStatus } from '../../domain/services/food-budget-status';
import { FoodJournalDto } from './food-journal.dto';

export class FoodBudgetStatusDto {
  @ApiProperty({
    enum: ['dans-le-budget', 'depassement', 'pas-de-donnees-recentes'],
  })
  statut: FoodBudgetStatus;

  @ApiProperty() budgetCalorique: number;

  @ApiProperty({ type: Number, nullable: true }) ecartKcal: number | null;

  @ApiProperty({ type: FoodJournalDto, nullable: true })
  journal: FoodJournalDto | null;
}
