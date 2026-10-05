import { ApiProperty } from '@nestjs/swagger';
import type { FoodBudgetStatus } from '../../domain/services/food-budget-status';
import { FoodJournalDto } from './food-journal.dto';

export class MacroTargetsDto {
  @ApiProperty() proteinesG: number;
  @ApiProperty() glucidesG: number;
  @ApiProperty() lipidesG: number;
}

export class FoodBudgetStatusDto {
  @ApiProperty({
    enum: ['dans-le-budget', 'depassement', 'pas-de-donnees-recentes'],
  })
  statut: FoodBudgetStatus;

  @ApiProperty() budgetCalorique: number;

  @ApiProperty({ type: MacroTargetsDto }) ciblesMacros: MacroTargetsDto;

  @ApiProperty({ type: Number, nullable: true }) ecartKcal: number | null;

  @ApiProperty({ type: FoodJournalDto, nullable: true })
  journal: FoodJournalDto | null;
}
