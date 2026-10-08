import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
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
import { GetClientProgressionUseCase } from '../../application/use-cases/get-client-progression.use-case';
import { GetClientsOverviewUseCase } from '../../application/use-cases/get-clients-overview.use-case';
import {
  ClientOverviewDto,
  ClientProgressionDto,
  toClientOverviewDto,
  toClientProgressionDto,
} from './coach-progression.dto';

type CoachRequest = Request & { user: JwtPayload };

@ApiTags('coach')
@ApiBearerAuth()
@Controller('coach/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoachProgressionController {
  constructor(
    private readonly overview: GetClientsOverviewUseCase,
    private readonly progression: GetClientProgressionUseCase,
  ) {}

  @Get()
  @Roles('coach')
  @ApiOperation({
    summary:
      'Utilisateurs rattachés avec leurs statuts de suivi (poids et alimentation)',
  })
  @ApiResponse({ status: 200, type: ClientOverviewDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle coach requis' })
  async list(@Req() req: CoachRequest): Promise<ClientOverviewDto[]> {
    const clients = await this.overview.execute(req.user.sub);
    return clients.map(toClientOverviewDto);
  }

  @Get(':userId')
  @Roles('coach')
  @ApiOperation({
    summary:
      "Progression d'un utilisateur rattaché : plan, pesées, totaux caloriques des 7 derniers jours",
  })
  @ApiResponse({ status: 200, type: ClientProgressionDto })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({
    status: 403,
    description: 'Rôle coach requis, ou utilisateur non rattaché à ce coach',
  })
  async detail(
    @Req() req: CoachRequest,
    @Param('userId') userId: string,
  ): Promise<ClientProgressionDto> {
    const progression = await this.progression.execute({
      coachId: req.user.sub,
      userId,
    });
    return toClientProgressionDto(progression);
  }
}
