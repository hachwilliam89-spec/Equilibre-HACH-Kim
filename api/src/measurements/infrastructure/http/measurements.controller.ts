import { ReceiveMeasurementUseCase } from '../../application/use-cases/receive-measurement.use-case';
import {
  ReceiveMeasurementDto,
  receiveMeasurementSchema,
} from './receive-measurement.dto';
import { ZodValidationPipe } from '../../../auth/infrastructure/http/dto/zod-validation.pipe';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../auth/infrastructure/http/jwt-auth.guard';
import type { JwtPayload } from '../../../auth/infrastructure/http/jwt.strategy';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { GetMeasurementHistoryUseCase } from '../../application/use-cases/get-measurement-history.use-case';
import { GetWeightTrackingStatusUseCase } from '../../application/use-cases/get-weight-tracking-status.use-case';
import { CorrectMeasurementUseCase } from '../../application/use-cases/correct-measurement.use-case';
import { MeasurementDto, toMeasurementDto } from './measurement.dto';
import { SuiviDto, toSuiviDto } from './suivi.dto';

@ApiTags('measurements')
@ApiBearerAuth()
@Controller('measurements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeasurementsController {
  constructor(
    private readonly getHistory: GetMeasurementHistoryUseCase,
    private readonly receiveMeasurement: ReceiveMeasurementUseCase,
    private readonly getStatus: GetWeightTrackingStatusUseCase,
    private readonly correctMeasurement: CorrectMeasurementUseCase,
  ) {}

  @Post()
  @Roles('utilisateur')
  @ApiOperation({
    summary: 'Recevoir une mesure automatique pour le plan actif',
    description:
      'Utilisateur issu du JWT ; horodatage et jour UTC calculés par le serveur. Le corps contient uniquement poidsKg. Le statut est classé automatiquement : valide, suspecte (écart > 3 kg avec la veille du même plan) ou hors-plan (hors de la période du plan actif).',
  })
  @ApiBody({ type: ReceiveMeasurementDto })
  @ApiResponse({
    status: 201,
    type: MeasurementDto,
    description: 'Mesure enregistrée',
  })
  @ApiResponse({
    status: 400,
    description: 'Poids absent, non numérique, non positif ou champ inattendu',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Réservé au rôle utilisateur' })
  @ApiResponse({
    status: 409,
    description:
      'Une mesure valide existe déjà pour ce jour (measurement-day-conflict) ou identifiant déjà pris',
  })
  @ApiResponse({ status: 422, description: 'Aucun plan actif' })
  @ApiResponse({ status: 429, description: 'Trop de requêtes' })
  async receive(
    @Req() request: Request & { user: JwtPayload },
    @Body(new ZodValidationPipe(receiveMeasurementSchema))
    body: ReceiveMeasurementDto,
  ): Promise<MeasurementDto> {
    const measurement = await this.receiveMeasurement.execute(
      request.user.sub,
      body.poidsKg,
    );
    return toMeasurementDto(measurement);
  }

  @Post('correction')
  @Roles('utilisateur')
  @ApiOperation({
    summary: 'Correction manuelle du poids en secours',
    description:
      'Secours quand aucune mesure automatique valide du jour, ou quand celle du jour est suspecte. Source manuelle, jamais soumise au controle suspecte ; classee hors-plan hors periode du plan. Refusee 409 si une mesure valide existe deja ce jour.',
  })
  @ApiBody({ type: ReceiveMeasurementDto })
  @ApiResponse({
    status: 201,
    type: MeasurementDto,
    description:
      'Correction enregistree (valide, ou hors-plan si hors periode)',
  })
  @ApiResponse({
    status: 400,
    description: 'Poids absent, non numerique ou non positif',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Reserve au role utilisateur' })
  @ApiResponse({
    status: 409,
    description: 'Une mesure valide existe deja ce jour',
  })
  @ApiResponse({ status: 422, description: 'Aucun plan actif' })
  async correction(
    @Req() request: Request & { user: JwtPayload },
    @Body(new ZodValidationPipe(receiveMeasurementSchema))
    body: ReceiveMeasurementDto,
  ): Promise<MeasurementDto> {
    const measurement = await this.correctMeasurement.execute(
      request.user.sub,
      body.poidsKg,
    );
    return toMeasurementDto(measurement);
  }

  @Get('me')
  @Roles('utilisateur')
  @ApiOperation({
    summary:
      'Historique personnel, tous plans, sources et statuts, par réception décroissante',
  })
  @ApiResponse({
    status: 200,
    type: MeasurementDto,
    isArray: true,
    description: 'Toutes les mesures, ou une liste vide',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Réservé au rôle utilisateur' })
  async getMine(
    @Req() request: Request & { user: JwtPayload },
  ): Promise<MeasurementDto[]> {
    const measurements = await this.getHistory.execute(request.user.sub);
    return measurements.map(toMeasurementDto);
  }

  @Get('me/suivi')
  @Roles('utilisateur')
  @ApiOperation({
    summary:
      'Statut de suivi du poids (dernière mesure valide, écart de trajectoire, résumé du plan)',
  })
  @ApiResponse({
    status: 200,
    type: SuiviDto,
    description: 'Statut de suivi, ou null si aucun plan actif',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Réservé au rôle utilisateur' })
  async getMonSuivi(
    @Req() request: Request & { user: JwtPayload },
    @Res() response: Response,
  ): Promise<Response> {
    const suivi = await this.getStatus.execute(request.user.sub);
    if (!suivi) {
      return response.json(null);
    }
    const body: SuiviDto = toSuiviDto(suivi);
    return response.json(body);
  }
}
