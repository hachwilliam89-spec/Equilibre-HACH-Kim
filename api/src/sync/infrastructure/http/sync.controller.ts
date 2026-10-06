import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../../auth/infrastructure/http/dto/zod-validation.pipe';
import { JwtAuthGuard } from '../../../auth/infrastructure/http/jwt-auth.guard';
import type { JwtPayload } from '../../../auth/infrastructure/http/jwt.strategy';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { ApplySyncOperationsUseCase } from '../../application/use-cases/apply-sync-operations.use-case';
import { GetSyncSnapshotUseCase } from '../../application/use-cases/get-sync-snapshot.use-case';
import {
  PushOperationsDto,
  type PushOperationsInput,
  PushResultDto,
  SyncSnapshotDto,
  pushOperationsSchema,
  toOperationsDomaine,
  toResultatsDto,
  toSyncSnapshotDto,
} from './sync.dto';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(
    private readonly snapshot: GetSyncSnapshotUseCase,
    private readonly applyOperations: ApplySyncOperationsUseCase,
  ) {}

  @Get('me')
  @Roles('utilisateur')
  @ApiOperation({
    summary: 'Pull : instantané des données visibles par l’utilisateur',
    description:
      'Renvoie uniquement ce que l’application mobile affiche : suivi du poids, historique des mesures (3 mois), budget et journaux alimentaires d’aujourd’hui et d’hier, aliments favoris. Si le curseur fourni correspond au contenu actuel, la réponse est 204 sans corps.',
  })
  @ApiQuery({ name: 'curseur', required: false })
  @ApiResponse({ status: 200, type: SyncSnapshotDto })
  @ApiResponse({
    status: 204,
    description: 'Rien n’a changé depuis le curseur',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Réservé au rôle utilisateur' })
  async pull(
    @Req() request: Request & { user: JwtPayload },
    @Res() response: Response,
    @Query('curseur') curseur?: string,
  ): Promise<Response> {
    const maintenant = new Date();
    const dto = toSyncSnapshotDto(
      await this.snapshot.execute(request.user.sub, maintenant),
      maintenant,
    );
    // Données personnelles : aucun cache intermédiaire.
    response.setHeader('Cache-Control', 'no-store');
    if (curseur && curseur === dto.curseur) return response.status(204).end();
    return response.status(200).json(dto);
  }

  @Post('me/operations')
  @HttpCode(200)
  @Roles('utilisateur')
  @ApiOperation({
    summary: 'Push : rejouer les modifications faites hors ligne',
    description:
      'Applique les opérations dans l’ordre (ajout/retrait d’aliment, saisie de poids, favori) via les mêmes règles métier que les routes en ligne, puis renvoie le résultat de chaque opération et l’instantané à jour. Le rejeu est idempotent : une opération déjà appliquée renvoie deja-appliquee.',
  })
  @ApiBody({ type: PushOperationsDto })
  @ApiResponse({ status: 200, type: PushResultDto })
  @ApiResponse({ status: 400, description: 'Lot invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Réservé au rôle utilisateur' })
  @ApiResponse({ status: 429, description: 'Trop de requêtes' })
  async push(
    @Req() request: Request & { user: JwtPayload },
    @Res() response: Response,
    @Body(new ZodValidationPipe(pushOperationsSchema))
    body: PushOperationsInput,
  ): Promise<Response> {
    const resultats = await this.applyOperations.execute(
      request.user.sub,
      toOperationsDomaine(body),
    );
    const maintenant = new Date();
    const instantane = toSyncSnapshotDto(
      await this.snapshot.execute(request.user.sub, maintenant),
      maintenant,
    );
    const dto: PushResultDto = {
      resultats: toResultatsDto(resultats),
      instantane,
    };
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json(dto);
  }
}
