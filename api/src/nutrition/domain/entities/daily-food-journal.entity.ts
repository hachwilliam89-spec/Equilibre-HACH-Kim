import { type Plan } from '../../../plans/domain/entities/plan.entity';
import { FoodEntry, arrondirCentiemes } from './food-entry.entity';

export interface DailyFoodJournalProps {
  planId: string;
  jourUtc: string;
  budgetCalorique: number;
  entrees: FoodEntry[];
  totalCaloriesKcal: number;
  totalProteinesG: number;
  totalGlucidesG: number;
  totalLipidesG: number;
}

export class DailyFoodJournal {
  private constructor(private props: DailyFoodJournalProps) {}

  static create(plan: Plan, receivedAt: Date): DailyFoodJournal {
    if (
      !(receivedAt instanceof Date) ||
      !Number.isFinite(receivedAt.getTime())
    ) {
      throw new Error('Horodatage de réception invalide');
    }
    const planProps = plan.toProps();
    if (planProps.statut !== 'actif') {
      throw new Error('Le journal exige un plan actif');
    }
    return new DailyFoodJournal({
      planId: planProps.id,
      jourUtc: receivedAt.toISOString().slice(0, 10),
      budgetCalorique: planProps.budgetCalorique,
      entrees: [],
      totalCaloriesKcal: 0,
      totalProteinesG: 0,
      totalGlucidesG: 0,
      totalLipidesG: 0,
    });
  }

  static restore(props: DailyFoodJournalProps): DailyFoodJournal {
    return new DailyFoodJournal({
      ...props,
      entrees: props.entrees.map((entry) => FoodEntry.restore(entry.toProps())),
    });
  }

  ajouterEntree(entry: FoodEntry): void {
    const props = entry.toProps();
    if (props.receivedAt.toISOString().slice(0, 10) !== this.props.jourUtc) {
      throw new Error("L'entrée ne correspond pas au jour UTC du journal");
    }
    if (this.props.entrees.some((item) => item.toProps().id === props.id)) {
      throw new Error("L'identifiant d'entrée existe déjà dans le journal");
    }
    this.props.entrees.push(entry);
    this.recalculerTotaux();
  }

  retirerEntree(entryId: string): boolean {
    const index = this.props.entrees.findIndex(
      (item) => item.toProps().id === entryId,
    );
    if (index < 0) return false;
    this.props.entrees.splice(index, 1);
    this.recalculerTotaux();
    return true;
  }

  toProps(): DailyFoodJournalProps {
    return { ...this.props, entrees: [...this.props.entrees] };
  }

  private recalculerTotaux(): void {
    const entrees = this.props.entrees.map((entry) => entry.toProps());
    const somme = (
      field: 'caloriesKcal' | 'proteinesG' | 'glucidesG' | 'lipidesG',
    ) =>
      arrondirCentiemes(
        entrees.reduce((total, entry) => total + entry[field], 0),
      );
    this.props.totalCaloriesKcal = somme('caloriesKcal');
    this.props.totalProteinesG = somme('proteinesG');
    this.props.totalGlucidesG = somme('glucidesG');
    this.props.totalLipidesG = somme('lipidesG');
  }
}
