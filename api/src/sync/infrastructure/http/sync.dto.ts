import { createHash } from 'node:crypto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  FoodDto,
  toFoodDto,
} from '../../../foods/infrastructure/http/food.dto';
import {
  MeasurementDto,
  toMeasurementDto,
} from '../../../measurements/infrastructure/http/measurement.dto';
import {
  SuiviDto,
  toSuiviDto,
} from '../../../measurements/infrastructure/http/suivi.dto';
import { MEAL_CATEGORIES } from '../../../nutrition/domain/entities/food-entry.entity';
import { MacroTargetsDto } from '../../../nutrition/infrastructure/http/food-budget-status.dto';
import {
  FoodJournalDto,
  toFoodJournalDto,
} from '../../../nutrition/infrastructure/http/food-journal.dto';
import {
  MAX_OPERATIONS_PAR_LOT,
  type OperationSynchro,
  type ResultatOperation,
  type StatutOperation,
} from '../../domain/operation-synchro';
import type { InstantaneSynchro } from '../../application/use-cases/get-sync-snapshot.use-case';

// ---------- Entrée : opérations rejouées ----------

const horodatage = z.iso.datetime({ offset: true });

const operationSchema = z.discriminatedUnion('type', [
  z
    .object({
      id: z.uuid(),
      type: z.literal('ajout-aliment'),
      entreeId: z.uuid({ version: 'v4' }),
      foodId: z.uuid(),
      quantiteGrammes: z.number().positive().finite().max(10000),
      categorieRepas: z.enum(MEAL_CATEGORIES).optional(),
      consommeLe: horodatage,
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal('retrait-aliment'),
      entreeId: z.uuid(),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal('saisie-poids'),
      mesureId: z.uuid({ version: 'v4' }),
      poidsKg: z.number().positive().finite().max(500),
      saisiLe: horodatage,
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal('favori'),
      foodId: z.uuid(),
      favori: z.boolean(),
    })
    .strict(),
]);

export const pushOperationsSchema = z
  .object({
    operations: z
      .array(operationSchema)
      .min(1)
      .max(MAX_OPERATIONS_PAR_LOT)
      .refine(
        (ops) => new Set(ops.map((op) => op.id)).size === ops.length,
        'Identifiants d’opération en double',
      ),
  })
  .strict();

export type PushOperationsInput = z.infer<typeof pushOperationsSchema>;

/** Les horodatages voyagent en ISO 8601 ; le domaine manipule des Date. */
export function toOperationsDomaine(
  input: PushOperationsInput,
): OperationSynchro[] {
  return input.operations.map((operation) => {
    switch (operation.type) {
      case 'ajout-aliment':
        return { ...operation, consommeLe: new Date(operation.consommeLe) };
      case 'saisie-poids':
        return { ...operation, saisiLe: new Date(operation.saisiLe) };
      default:
        return operation;
    }
  });
}

export class PushOperationsDto extends createZodDto(pushOperationsSchema) {}

// ---------- Sortie : instantané du strict nécessaire ----------

export class AlimentationSyncDto {
  @ApiProperty({ format: 'uuid' }) planId: string;
  @ApiProperty() budgetCalorique: number;
  @ApiProperty({ type: MacroTargetsDto }) ciblesMacros: MacroTargetsDto;
  @ApiProperty({
    type: [FoodJournalDto],
    description: 'Journaux du plan actif pour aujourd’hui et hier (UTC)',
  })
  journaux: FoodJournalDto[];
}

export class SyncSnapshotDto {
  @ApiProperty({
    description:
      'Empreinte du contenu. Renvoyée au prochain pull : si rien n’a changé, réponse 204 sans corps.',
  })
  curseur: string;

  @ApiProperty({ type: String, format: 'date-time' })
  genereLe: string;

  @ApiProperty({ type: SuiviDto, nullable: true })
  suiviPoids: SuiviDto | null;

  @ApiProperty({ type: [MeasurementDto] })
  mesures: MeasurementDto[];

  @ApiProperty({ type: AlimentationSyncDto, nullable: true })
  alimentation: AlimentationSyncDto | null;

  @ApiProperty({ type: [FoodDto] })
  favoris: FoodDto[];
}

export class ResultatOperationDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({
    enum: ['appliquee', 'deja-appliquee', 'rejetee', 'a-reessayer'],
  })
  statut: StatutOperation;
  @ApiPropertyOptional() code?: string;
  @ApiPropertyOptional() message?: string;
}

export class PushResultDto {
  @ApiProperty({ type: [ResultatOperationDto] })
  resultats: ResultatOperationDto[];

  @ApiProperty({
    type: SyncSnapshotDto,
    description: 'Instantané à jour, pour éviter un second appel',
  })
  instantane: SyncSnapshotDto;
}

export function toSyncSnapshotDto(
  instantane: InstantaneSynchro,
  maintenant = new Date(),
): SyncSnapshotDto {
  const contenu = {
    suiviPoids: instantane.suiviPoids
      ? toSuiviDto(instantane.suiviPoids)
      : null,
    mesures: instantane.mesures.map(toMeasurementDto),
    alimentation: instantane.alimentation
      ? {
          planId: instantane.alimentation.planId,
          budgetCalorique: instantane.alimentation.budgetCalorique,
          ciblesMacros: instantane.alimentation.ciblesMacros,
          journaux: instantane.alimentation.journaux.map(toFoodJournalDto),
        }
      : null,
    favoris: instantane.favoris.map(toFoodDto),
  };
  return {
    curseur: calculerCurseur(contenu, maintenant),
    genereLe: maintenant.toISOString(),
    ...contenu,
  };
}

/**
 * Empreinte du contenu visible + jour UTC : un statut qui change avec la
 * date (« pas de données récentes ») invalide aussi le curseur.
 */
export function calculerCurseur(contenu: unknown, maintenant: Date): string {
  return createHash('sha256')
    .update(maintenant.toISOString().slice(0, 10))
    .update(JSON.stringify(contenu))
    .digest('hex')
    .slice(0, 32);
}

export function toResultatsDto(
  resultats: ResultatOperation[],
): ResultatOperationDto[] {
  return resultats.map((resultat) => ({ ...resultat }));
}
