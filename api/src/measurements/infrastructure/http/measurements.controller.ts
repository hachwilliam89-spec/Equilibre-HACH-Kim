import { ReceiveMeasurementUseCase } from '../../application/use-cases/receive-measurement.use-case';
import {
  ReceiveMeasurementDto,
  receiveMeasurementSchema,
} from './receive-measurement.dto';
import { ZodValidationPipe } from '../../../auth/infrastructure/http/dto/zod-validation.pipe';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { GetMeasurementHistoryUseCase } from '../../application/use-cases/get-measurement-history.use-case';
import { MeasurementDto } from './measurement.dto';

@ApiTags('measurements')
@ApiBearerAuth()
@Controller('measurements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeasurementsController {
  constructor(
    private readonly getHistory: GetMeasurementHistoryUseCase,
    private readonly receiveMeasurement: ReceiveMeasurementUseCase,
  ) {}

  @Post()
  @Roles('utilisateur')
  @ApiOperation({
    summary: 'Recevoir une mesure automatique pour le plan actif',
    description:
      'Utilisateur issu du JWT ; horodatage et jour UTC calculés par le serveur. Le corps contient uniquement poidsKg.',
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
    const props = measurement.toProps();
    return { ...props, receivedAt: props.receivedAt.toISOString() };
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
    return measurements.map((measurement) => {
      const props = measurement.toProps();
      return { ...props, receivedAt: props.receivedAt.toISOString() };
    });
  }
}
