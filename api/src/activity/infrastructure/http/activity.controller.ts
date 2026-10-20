import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { GetActivityUseCase } from '../../application/use-cases/get-activity.use-case';
import { RecordStepsUseCase } from '../../application/use-cases/record-steps.use-case';
import {
  ActiviteDto,
  PasQuotidienDto,
  RecordStepsDto,
  recordStepsSchema,
  toActiviteDto,
  toPasQuotidienDto,
} from './activity.dto';

type UserRequest = Request & { user: JwtPayload };

@ApiTags('activity')
@ApiBearerAuth()
@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('utilisateur')
export class ActivityController {
  constructor(
    private readonly recordSteps: RecordStepsUseCase,
    private readonly getActivity: GetActivityUseCase,
  ) {}

  @Post('steps')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Recevoir le total de pas du jour (montre connectee)',
    description:
      'Utilisateur issu du JWT ; jour UTC et horodatage fixes par le serveur. Un nouvel envoi le meme jour remplace la valeur precedente. Aucun plan actif requis.',
  })
  @ApiBody({ type: RecordStepsDto })
  @ApiResponse({ status: 201, type: PasQuotidienDto })
  @ApiResponse({
    status: 400,
    description:
      'Nombre de pas absent, non entier, negatif ou superieur a 50 000',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Reserve au role utilisateur' })
  @ApiResponse({ status: 409, description: 'Modification simultanee du suivi' })
  @ApiResponse({ status: 429, description: 'Trop de requetes' })
  async record(
    @Req() request: UserRequest,
    @Body(new ZodValidationPipe(recordStepsSchema)) body: RecordStepsDto,
  ): Promise<PasQuotidienDto> {
    return toPasQuotidienDto(
      await this.recordSteps.execute(request.user.sub, body.nombrePas),
    );
  }

  @Get('me')
  @ApiOperation({
    summary: 'Historique des pas et moyenne des 7 jours precedents',
    description:
      'Informatif : aucun statut ni alerte. Le niveau est deduit seulement si les 7 jours precedant aujourd’hui sont renseignes.',
  })
  @ApiResponse({ status: 200, type: ActiviteDto })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Reserve au role utilisateur' })
  async mine(@Req() request: UserRequest): Promise<ActiviteDto> {
    return toActiviteDto(await this.getActivity.execute(request.user.sub));
  }
}
