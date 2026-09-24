import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
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
  constructor(private readonly getHistory: GetMeasurementHistoryUseCase) {}

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
