import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../auth/infrastructure/http/jwt-auth.guard';
import type { JwtPayload } from '../../../auth/infrastructure/http/jwt.strategy';
import { ZodValidationPipe } from '../../../auth/infrastructure/http/dto/zod-validation.pipe';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { AddFoodEntryUseCase } from '../../application/use-cases/add-food-entry.use-case';
import { RemoveFoodEntryUseCase } from '../../application/use-cases/remove-food-entry.use-case';
import { GetFoodBudgetStatusUseCase } from '../../application/use-cases/get-food-budget-status.use-case';
import { AddFoodEntryDto, addFoodEntrySchema } from './add-food-entry.dto';
import { FoodJournalDto, toFoodJournalDto } from './food-journal.dto';
import { FoodBudgetStatusDto } from './food-budget-status.dto';

@ApiTags('food-journals')
@ApiBearerAuth()
@Controller('food-journals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FoodJournalsController {
  constructor(
    private readonly addFoodEntry: AddFoodEntryUseCase,
    private readonly removeFoodEntry: RemoveFoodEntryUseCase,
    private readonly getFoodBudgetStatus: GetFoodBudgetStatusUseCase,
  ) {}

  @Post('me/entries')
  @Roles('utilisateur')
  @ApiOperation({
    summary: 'Ajouter un aliment consommé au journal du jour UTC',
    description:
      'Le serveur détermine le jour UTC, copie les valeurs pour 100 g du référentiel et calcule les valeurs consommées selon la quantité. La catégorie de repas sert uniquement au classement visuel ; le budget reste quotidien. Le journal et ses totaux sont renvoyés immédiatement.',
  })
  @ApiBody({ type: AddFoodEntryDto })
  @ApiResponse({ status: 201, type: FoodJournalDto })
  @ApiResponse({
    status: 400,
    description: 'Aliment, quantité ou catégorie de repas invalide',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Réservé au rôle utilisateur' })
  @ApiResponse({ status: 404, description: 'Aliment introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Conflit de mise à jour simultanée',
  })
  @ApiResponse({ status: 422, description: 'Aucun plan actif' })
  @ApiResponse({ status: 429, description: 'Trop de requêtes' })
  async add(
    @Req() request: Request & { user: JwtPayload },
    @Body(new ZodValidationPipe(addFoodEntrySchema)) body: AddFoodEntryDto,
  ): Promise<FoodJournalDto> {
    const journal = await this.addFoodEntry.execute(
      request.user.sub,
      body.foodId,
      body.quantiteGrammes,
      body.categorieRepas,
    );
    return toFoodJournalDto(journal);
  }

  @Delete('me/entries/:entryId')
  @Roles('utilisateur')
  @ApiOperation({
    summary: 'Retirer une entrée alimentaire et recalculer le journal',
    description:
      "L'entrée doit appartenir à l'utilisateur connecté. Le journal recalculé est renvoyé, même s'il devient vide. Un plan encore actif n'est pas nécessaire pour corriger une ancienne journée conservée.",
  })
  @ApiParam({ name: 'entryId', format: 'uuid' })
  @ApiResponse({ status: 200, type: FoodJournalDto })
  @ApiResponse({ status: 400, description: 'Identifiant invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Réservé au rôle utilisateur' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Conflit de mise à jour simultanée',
  })
  @ApiResponse({ status: 429, description: 'Trop de requêtes' })
  async remove(
    @Req() request: Request & { user: JwtPayload },
    @Param('entryId', new ParseUUIDPipe({ version: '4' })) entryId: string,
  ): Promise<FoodJournalDto> {
    const journal = await this.removeFoodEntry.execute(
      request.user.sub,
      entryId,
    );
    return toFoodJournalDto(journal);
  }

  @Get('me/status')
  @Roles('utilisateur')
  @ApiOperation({
    summary: 'Statut alimentaire par rapport au budget du plan actif',
    description:
      'Dernier journal non vide du plan actif : écart signé total − budget. Dépassement si écart > 150 kcal. Sans entrée aujourd’hui ni hier, statut pas-de-donnees-recentes. Réponse null sans plan actif.',
  })
  @ApiResponse({
    status: 200,
    type: FoodBudgetStatusDto,
    description: 'Statut alimentaire, ou null sans plan actif',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Réservé au rôle utilisateur' })
  @ApiResponse({ status: 429, description: 'Trop de requêtes' })
  async status(
    @Req() request: Request & { user: JwtPayload },
    @Res() response: Response,
  ): Promise<Response> {
    const result = await this.getFoodBudgetStatus.execute(request.user.sub);
    const body: FoodBudgetStatusDto | null = result
      ? {
          statut: result.statut,
          budgetCalorique: result.budgetCalorique,
          ciblesMacros: result.ciblesMacros,
          ecartKcal: result.ecartKcal,
          journal: result.journal ? toFoodJournalDto(result.journal) : null,
        }
      : null;
    return response.status(200).json(body);
  }
}
