import { ApiProperty } from '@nestjs/swagger';
import {
  FOOD_CATEGORIES,
  type Food,
  type FoodCategory,
} from '../../domain/entities/food.entity';

export class FoodDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nom: string;
  @ApiProperty({ enum: FOOD_CATEGORIES }) categorie: FoodCategory;
  @ApiProperty({ description: 'Kilocalories pour 100 g' })
  caloriesKcalPour100g: number;
  @ApiProperty({ description: 'Grammes de protéines pour 100 g' })
  proteinesGPour100g: number;
  @ApiProperty({ description: 'Grammes de glucides pour 100 g' })
  glucidesGPour100g: number;
  @ApiProperty({ description: 'Grammes de lipides pour 100 g' })
  lipidesGPour100g: number;
}

export function toFoodDto(food: Food): FoodDto {
  const props = food.toProps();
  return {
    id: props.id,
    nom: props.nom,
    categorie: props.categorie,
    caloriesKcalPour100g: props.caloriesKcalPour100g,
    proteinesGPour100g: props.proteinesGPour100g,
    glucidesGPour100g: props.glucidesGPour100g,
    lipidesGPour100g: props.lipidesGPour100g,
  };
}
