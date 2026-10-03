import {
  Food,
  type FoodProps,
} from '../../../foods/domain/entities/food.entity';

export type FoodSnapshot = Pick<
  FoodProps,
  | 'id'
  | 'nom'
  | 'caloriesKcalPour100g'
  | 'proteinesGPour100g'
  | 'glucidesGPour100g'
  | 'lipidesGPour100g'
>;

export const MEAL_CATEGORIES = [
  'petit-dejeuner',
  'dejeuner',
  'diner',
  'collation',
  'non-classe',
] as const;

export type MealCategory = (typeof MEAL_CATEGORIES)[number];

export interface FoodEntryProps {
  id: string;
  aliment: FoodSnapshot;
  quantiteGrammes: number;
  caloriesKcal: number;
  proteinesG: number;
  glucidesG: number;
  lipidesG: number;
  receivedAt: Date;
  // Facultatif pour relire les entrées enregistrées avant le classement par repas.
  categorieRepas?: MealCategory;
}

export interface FoodEntryCreateProps {
  id: string;
  aliment: FoodProps;
  quantiteGrammes: number;
  receivedAt: Date;
  categorieRepas?: MealCategory;
}

export function arrondirCentiemes(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export class FoodEntry {
  private constructor(private readonly props: FoodEntryProps) {}

  static create(input: FoodEntryCreateProps): FoodEntry {
    if (!input.id.trim())
      throw new Error("L'identifiant d'entrée est obligatoire");
    if (!Number.isFinite(input.quantiteGrammes) || input.quantiteGrammes <= 0) {
      throw new Error('La quantité doit être strictement positive');
    }
    if (
      !(input.receivedAt instanceof Date) ||
      !Number.isFinite(input.receivedAt.getTime())
    ) {
      throw new Error('Horodatage de réception invalide');
    }
    const food = Food.create(input.aliment).toProps();
    const coefficient = input.quantiteGrammes / 100;
    return new FoodEntry({
      id: input.id,
      aliment: {
        id: food.id,
        nom: food.nom,
        caloriesKcalPour100g: food.caloriesKcalPour100g,
        proteinesGPour100g: food.proteinesGPour100g,
        glucidesGPour100g: food.glucidesGPour100g,
        lipidesGPour100g: food.lipidesGPour100g,
      },
      quantiteGrammes: input.quantiteGrammes,
      caloriesKcal: arrondirCentiemes(food.caloriesKcalPour100g * coefficient),
      proteinesG: arrondirCentiemes(food.proteinesGPour100g * coefficient),
      glucidesG: arrondirCentiemes(food.glucidesGPour100g * coefficient),
      lipidesG: arrondirCentiemes(food.lipidesGPour100g * coefficient),
      receivedAt: new Date(input.receivedAt),
      categorieRepas: input.categorieRepas ?? 'non-classe',
    });
  }

  static restore(props: FoodEntryProps): FoodEntry {
    return new FoodEntry({
      ...props,
      aliment: { ...props.aliment },
      receivedAt: new Date(props.receivedAt),
      categorieRepas: props.categorieRepas ?? 'non-classe',
    });
  }

  toProps(): FoodEntryProps {
    return {
      ...this.props,
      aliment: { ...this.props.aliment },
      receivedAt: new Date(this.props.receivedAt),
    };
  }
}
