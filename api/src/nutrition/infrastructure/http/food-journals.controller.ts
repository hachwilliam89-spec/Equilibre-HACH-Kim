import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
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
import { AddFoodEntryDto, addFoodEntrySchema } from './add-food-entry.dto';
import { FoodJournalDto, toFoodJournalDto } from './food-journal.dto';

@ApiTags('food-journals')
@ApiBearerAuth()
@Controller('food-journals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FoodJournalsController {
  constructor(private readonly addFoodEntry: AddFoodEntryUseCase) {}

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
}
