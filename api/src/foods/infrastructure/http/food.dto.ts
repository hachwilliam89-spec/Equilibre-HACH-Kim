import { ApiProperty } from '@nestjs/swagger';

export class FoodDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nom: string;
  @ApiProperty({ description: 'Kilocalories pour 100 g' })
  caloriesKcalPour100g: number;
  @ApiProperty({ description: 'Grammes de protéines pour 100 g' })
  proteinesGPour100g: number;
  @ApiProperty({ description: 'Grammes de glucides pour 100 g' })
  glucidesGPour100g: number;
  @ApiProperty({ description: 'Grammes de lipides pour 100 g' })
  lipidesGPour100g: number;
}
