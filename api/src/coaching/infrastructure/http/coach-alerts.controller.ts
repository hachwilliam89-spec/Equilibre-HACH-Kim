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
import { GetCoachAlertsUseCase } from '../../application/use-cases/get-coach-alerts.use-case';
import { ClientAlertesDto, toClientAlertesDto } from './coach-progression.dto';

type CoachRequest = Request & { user: JwtPayload };

@ApiTags('coach')
@ApiBearerAuth()
@Controller('coach/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoachAlertsController {
  constructor(private readonly alerts: GetCoachAlertsUseCase) {}

  @Get()
  @Roles('coach')
  @ApiOperation({
    summary:
      'Utilisateurs rattachés en écart persistant (3 valeurs consécutives hors tolérance)',
    description:
      'Poids : pesées valides à plus de 1 kg de la trajectoire. Calories : journées clôturées au-delà de budget + 150 kcal. Calculé à la lecture (US5).',
  })
  @ApiResponse({ status: 200, type: ClientAlertesDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle coach requis' })
  async list(@Req() req: CoachRequest): Promise<ClientAlertesDto[]> {
    const clients = await this.alerts.execute(req.user.sub);
    return clients.map(toClientAlertesDto);
  }
}
