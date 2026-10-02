import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
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
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../auth/infrastructure/http/jwt-auth.guard';
import type { JwtPayload } from '../../../auth/infrastructure/http/jwt.strategy';
import { ZodValidationPipe } from '../../../auth/infrastructure/http/dto/zod-validation.pipe';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { AddFoodEntryUseCase } from '../../application/use-cases/add-food-entry.use-case';
import { RemoveFoodEntryUseCase } from '../../application/use-cases/remove-food-entry.use-case';
import { AddFoodEntryDto, addFoodEntrySchema } from './add-food-entry.dto';
import { FoodJournalDto, toFoodJournalDto } from './food-journal.dto';

@ApiTags('food-journals')
@ApiBearerAuth()
@Controller('food-journals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FoodJournalsController {
  constructor(
    private readonly addFoodEntry: AddFoodEntryUseCase,
    private readonly removeFoodEntry: RemoveFoodEntryUseCase,
  ) {}

  @Post('me/entries')
  @Roles('utilisateur')
  @ApiOperation({
    summary: 'Ajouter un aliment consommé au journal du jour UTC',
    description:
      'Le serveur détermine le jour UTC, copie les valeurs pour 100 g du référentiel et calcule les valeurs consommées selon la quantité. Le journal et ses totaux sont renvoyés immédiatement.',
  })
  @ApiBody({ type: AddFoodEntryDto })
  @ApiResponse({ status: 201, type: FoodJournalDto })
  @ApiResponse({ status: 400, description: 'Aliment ou quantité invalide' })
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
}
