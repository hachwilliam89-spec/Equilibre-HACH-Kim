import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ManageFavoriteFoodsUseCase } from '../../../foods/application/use-cases/manage-favorite-foods.use-case';
import { CorrectMeasurementUseCase } from '../../../measurements/application/use-cases/correct-measurement.use-case';
import { AddFoodEntryUseCase } from '../../../nutrition/application/use-cases/add-food-entry.use-case';
import { RemoveFoodEntryUseCase } from '../../../nutrition/application/use-cases/remove-food-entry.use-case';
import type {
  OperationSynchro,
  ResultatOperation,
} from '../../domain/operation-synchro';

/** Conflits de concurrence optimiste : l'opération pourra être rejouée. */
const CODES_TRANSITOIRES = new Set([
  'food-journal-concurrent-update',
  'measurement-concurrent-update',
]);

/**
 * Rejoue, dans l'ordre de saisie, les modifications faites sur l'appareil.
 * Aucune règle métier n'est dupliquée : chaque opération passe par le même
 * use case que la route en ligne correspondante. Une opération refusée
 * n'interrompt pas le lot : son résultat est renvoyé et les suivantes sont
 * traitées.
 */
@Injectable()
export class ApplySyncOperationsUseCase {
  private readonly logger = new Logger(ApplySyncOperationsUseCase.name);

  constructor(
    private readonly addFoodEntry: AddFoodEntryUseCase,
    private readonly removeFoodEntry: RemoveFoodEntryUseCase,
    private readonly correctMeasurement: CorrectMeasurementUseCase,
    private readonly favoriteFoods: ManageFavoriteFoodsUseCase,
  ) {}

  async execute(
    userId: string,
    operations: OperationSynchro[],
  ): Promise<ResultatOperation[]> {
    const resultats: ResultatOperation[] = [];
    for (const operation of operations) {
      resultats.push(await this.appliquer(userId, operation));
    }
    return resultats;
  }

  private async appliquer(
    userId: string,
    operation: OperationSynchro,
  ): Promise<ResultatOperation> {
    try {
      switch (operation.type) {
        case 'ajout-aliment': {
          const { dejaAppliquee } =
            await this.addFoodEntry.executeDepuisSynchro(userId, operation);
          return this.succes(operation.id, dejaAppliquee);
        }
        case 'retrait-aliment':
          try {
            await this.removeFoodEntry.execute(userId, operation.entreeId);
            return this.succes(operation.id, false);
          } catch (error) {
            // Déjà retirée (rejeu, ou retrait depuis un autre appareil).
            if (codeErreur(error) === 'food-entry-not-found') {
              return this.succes(operation.id, true);
            }
            throw error;
          }
        case 'saisie-poids': {
          const { dejaAppliquee } =
            await this.correctMeasurement.executeDepuisSynchro(
              userId,
              operation,
            );
          return this.succes(operation.id, dejaAppliquee);
        }
        case 'favori':
          // Ajout et retrait de favori sont idempotents par nature.
          if (operation.favori) {
            await this.favoriteFoods.add(userId, operation.foodId);
          } else {
            await this.favoriteFoods.remove(userId, operation.foodId);
          }
          return this.succes(operation.id, false);
      }
    } catch (error) {
      return this.echec(operation, error);
    }
  }

  private succes(id: string, dejaAppliquee: boolean): ResultatOperation {
    return { id, statut: dejaAppliquee ? 'deja-appliquee' : 'appliquee' };
  }

  private echec(
    operation: OperationSynchro,
    error: unknown,
  ): ResultatOperation {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const code = codeErreur(error);
      const transitoire =
        status >= 500 ||
        status === Number(HttpStatus.TOO_MANY_REQUESTS) ||
        (code !== undefined && CODES_TRANSITOIRES.has(code));
      return {
        id: operation.id,
        statut: transitoire ? 'a-reessayer' : 'rejetee',
        code,
        message: messageErreur(error),
      };
    }
    // Erreur inattendue : on garde l'opération côté appareil, qui limite
    // lui-même le nombre de tentatives.
    this.logger.error(
      { err: error, operation: operation.type },
      'Échec inattendu lors du rejeu',
    );
    return {
      id: operation.id,
      statut: 'a-reessayer',
      code: 'erreur-interne',
      message: 'Erreur interne, nouvelle tentative plus tard',
    };
  }
}

function codeErreur(error: unknown): string | undefined {
  if (!(error instanceof HttpException)) return undefined;
  const body = error.getResponse();
  if (typeof body === 'object' && body !== null && 'type' in body) {
    const type = (body as { type?: unknown }).type;
    if (typeof type === 'string') return type.split('/').pop();
  }
  return `http-${error.getStatus()}`;
}

function messageErreur(error: HttpException): string {
  const body = error.getResponse();
  if (typeof body === 'object' && body !== null && 'title' in body) {
    const title = (body as { title?: unknown }).title;
    if (typeof title === 'string') return title;
  }
  return error.message;
}
