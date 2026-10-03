import { ApiProperty } from '@nestjs/swagger';
import { DailyFoodJournal } from '../../domain/entities/daily-food-journal.entity';

export class FoodEntryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) foodId: string;
  @ApiProperty() nom: string;
  @ApiProperty() quantiteGrammes: number;
  @ApiProperty() caloriesKcal: number;
  @ApiProperty() proteinesG: number;
  @ApiProperty() glucidesG: number;
  @ApiProperty() lipidesG: number;
  @ApiProperty({ format: 'date-time' }) receivedAt: string;
}

export class FoodJournalDto {
  @ApiProperty({ format: 'uuid' }) planId: string;
  @ApiProperty({ format: 'date' }) jourUtc: string;
  @ApiProperty() budgetCalorique: number;
  @ApiProperty({ type: [FoodEntryDto] }) entrees: FoodEntryDto[];
  @ApiProperty() totalCaloriesKcal: number;
  @ApiProperty() totalProteinesG: number;
  @ApiProperty() totalGlucidesG: number;
  @ApiProperty() totalLipidesG: number;
}

export function toFoodJournalDto(journal: DailyFoodJournal): FoodJournalDto {
  const props = journal.toProps();
  return {
    planId: props.planId,
    jourUtc: props.jourUtc,
    budgetCalorique: props.budgetCalorique,
    entrees: props.entrees.map((entry) => {
      const item = entry.toProps();
      return {
        id: item.id,
        foodId: item.aliment.id,
        nom: item.aliment.nom,
        quantiteGrammes: item.quantiteGrammes,
        caloriesKcal: item.caloriesKcal,
        proteinesG: item.proteinesG,
        glucidesG: item.glucidesG,
        lipidesG: item.lipidesG,
        receivedAt: item.receivedAt.toISOString(),
      };
    }),
    totalCaloriesKcal: props.totalCaloriesKcal,
    totalProteinesG: props.totalProteinesG,
    totalGlucidesG: props.totalGlucidesG,
    totalLipidesG: props.totalLipidesG,
  };
}
