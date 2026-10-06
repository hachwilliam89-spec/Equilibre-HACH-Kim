import { HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { AppException } from '../../../common/errors/app-exception';
import type { ManageFavoriteFoodsUseCase } from '../../../foods/application/use-cases/manage-favorite-foods.use-case';
import type { CorrectMeasurementUseCase } from '../../../measurements/application/use-cases/correct-measurement.use-case';
import type { AddFoodEntryUseCase } from '../../../nutrition/application/use-cases/add-food-entry.use-case';
import type { RemoveFoodEntryUseCase } from '../../../nutrition/application/use-cases/remove-food-entry.use-case';
import { ApplySyncOperationsUseCase } from './apply-sync-operations.use-case';

// Les use cases métier sont simulés : leurs règles sont testées dans leurs
// propres specs. On vérifie ici l'orchestration et la classification des
// résultats renvoyés à l'appareil.
function setup() {
  const add = { executeDepuisSynchro: jest.fn() };
  const remove = { execute: jest.fn() };
  const correct = { executeDepuisSynchro: jest.fn() };
  const favorites = { add: jest.fn(), remove: jest.fn() };
  const useCase = new ApplySyncOperationsUseCase(
    add as unknown as AddFoodEntryUseCase,
    remove as unknown as RemoveFoodEntryUseCase,
    correct as unknown as CorrectMeasurementUseCase,
    favorites as unknown as ManageFavoriteFoodsUseCase,
  );
  return { useCase, add, remove, correct, favorites };
}

const ajout = (id: string) => ({
  id,
  type: 'ajout-aliment' as const,
  entreeId: `entree-${id}`,
  foodId: 'food-1',
  quantiteGrammes: 120,
  consommeLe: new Date(),
});

describe('ApplySyncOperationsUseCase', () => {
  it("rejoue les opérations dans l'ordre et renvoie un résultat par opération", async () => {
    const { useCase, add, remove, favorites } = setup();
    const ordre: string[] = [];
    add.executeDepuisSynchro.mockImplementation(() => {
      ordre.push('ajout');
      return Promise.resolve({ dejaAppliquee: false });
    });
    remove.execute.mockImplementation(() => {
      ordre.push('retrait');
      return Promise.resolve();
    });
    favorites.add.mockImplementation(() => {
      ordre.push('favori');
      return Promise.resolve();
    });

    const resultats = await useCase.execute('user-1', [
      ajout('op-1'),
      { id: 'op-2', type: 'retrait-aliment', entreeId: 'entree-x' },
      { id: 'op-3', type: 'favori', foodId: 'food-1', favori: true },
    ]);

    expect(ordre).toEqual(['ajout', 'retrait', 'favori']);
    expect(resultats.map((r) => r.statut)).toEqual([
      'appliquee',
      'appliquee',
      'appliquee',
    ]);
  });

  it('signale un rejeu déjà traité sans erreur', async () => {
    const { useCase, add } = setup();
    add.executeDepuisSynchro.mockResolvedValue({ dejaAppliquee: true });

    const [resultat] = await useCase.execute('user-1', [ajout('op-1')]);

    expect(resultat).toEqual({ id: 'op-1', statut: 'deja-appliquee' });
  });

  it('considère le retrait d’une entrée introuvable comme déjà appliqué', async () => {
    const { useCase, remove } = setup();
    remove.execute.mockRejectedValue(
      new AppException(
        'food-entry-not-found',
        'Entrée alimentaire introuvable',
        HttpStatus.NOT_FOUND,
      ),
    );

    const [resultat] = await useCase.execute('user-1', [
      { id: 'op-1', type: 'retrait-aliment', entreeId: 'entree-1' },
    ]);

    expect(resultat.statut).toBe('deja-appliquee');
  });

  it('rejette définitivement un refus métier sans interrompre le lot', async () => {
    const { useCase, correct, add } = setup();
    correct.executeDepuisSynchro.mockRejectedValue(
      new AppException(
        'measurement-day-conflict',
        'Mesure déjà enregistrée aujourd’hui',
        HttpStatus.CONFLICT,
      ),
    );
    add.executeDepuisSynchro.mockResolvedValue({ dejaAppliquee: false });

    const resultats = await useCase.execute('user-1', [
      {
        id: 'op-1',
        type: 'saisie-poids',
        mesureId: 'mesure-1',
        poidsKg: 79.4,
        saisiLe: new Date(),
      },
      ajout('op-2'),
    ]);

    expect(resultats[0]).toEqual({
      id: 'op-1',
      statut: 'rejetee',
      code: 'measurement-day-conflict',
      message: 'Mesure déjà enregistrée aujourd’hui',
    });
    expect(resultats[1].statut).toBe('appliquee');
  });

  it('garde en file une opération en conflit de concurrence', async () => {
    const { useCase, add } = setup();
    add.executeDepuisSynchro.mockRejectedValue(
      new AppException(
        'food-journal-concurrent-update',
        'Le journal a été modifié simultanément, veuillez réessayer',
        HttpStatus.CONFLICT,
      ),
    );

    const [resultat] = await useCase.execute('user-1', [ajout('op-1')]);

    expect(resultat.statut).toBe('a-reessayer');
  });

  it('garde en file une opération en cas d’erreur inattendue', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { useCase, add } = setup();
    add.executeDepuisSynchro.mockRejectedValue(new Error('panne'));

    const [resultat] = await useCase.execute('user-1', [ajout('op-1')]);

    expect(resultat).toMatchObject({ statut: 'a-reessayer' });
  });

  it('rejette un favori vers un aliment inexistant', async () => {
    const { useCase, favorites } = setup();
    favorites.add.mockRejectedValue(
      new NotFoundException('Aliment introuvable'),
    );

    const [resultat] = await useCase.execute('user-1', [
      { id: 'op-1', type: 'favori', foodId: 'inconnu', favori: true },
    ]);

    expect(resultat).toMatchObject({ statut: 'rejetee', code: 'http-404' });
  });
});
