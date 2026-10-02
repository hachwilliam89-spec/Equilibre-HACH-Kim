export interface FoodProps {
  id: string;
  nom: string;
  nomNormalise: string;
  caloriesKcalPour100g: number;
  proteinesGPour100g: number;
  glucidesGPour100g: number;
  lipidesGPour100g: number;
}

export type FoodCreateProps = Omit<FoodProps, 'nomNormalise'>;

/**
 * Retire les accents et normalise les espaces pour disposer d'une cle de
 * recherche stable, independante de la casse et des accents saisis.
 */
export const normalizeFoodName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim()
    .replace(/\s+/g, ' ');

export class Food {
  private constructor(private readonly props: FoodProps) {}

  static create(input: FoodCreateProps): Food {
    const nom = input.nom.trim().replace(/\s+/g, ' ');
    if (!nom) throw new Error("Le nom de l'aliment est obligatoire");

    Food.assertNutritionalValue(
      'caloriesKcalPour100g',
      input.caloriesKcalPour100g,
      1000,
    );
    Food.assertNutritionalValue(
      'proteinesGPour100g',
      input.proteinesGPour100g,
      100,
    );
    Food.assertNutritionalValue(
      'glucidesGPour100g',
      input.glucidesGPour100g,
      100,
    );
    Food.assertNutritionalValue(
      'lipidesGPour100g',
      input.lipidesGPour100g,
      100,
    );

    return new Food({
      ...input,
      nom,
      nomNormalise: normalizeFoodName(nom),
    });
  }

  static restore(props: FoodProps): Food {
    return new Food(props);
  }

  toProps(): FoodProps {
    return { ...this.props };
  }

  private static assertNutritionalValue(
    field: string,
    value: number,
    maximum: number,
  ): void {
    if (!Number.isFinite(value) || value < 0 || value > maximum) {
      throw new Error(`${field} doit etre compris entre 0 et ${maximum}`);
    }
  }
}
