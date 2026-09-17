import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { RolesGuard } from '../../../common/auth/roles.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { CreatePlanUseCase } from '../../application/use-cases/create-plan.use-case';
import { GetCurrentPlanUseCase } from '../../application/use-cases/get-current-plan.use-case';
import { CancelPlanUseCase } from '../../application/use-cases/cancel-plan.use-case';
import { CreatePlanDto, createPlanSchema } from './dto/create-plan.dto';
import { ZodValidationPipe } from '../../../auth/infrastructure/http/dto/zod-validation.pipe';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(
    private readonly createPlanUseCase: CreatePlanUseCase,
    private readonly getCurrentPlanUseCase: GetCurrentPlanUseCase,
    private readonly cancelPlanUseCase: CancelPlanUseCase,
  ) {}

  @Post()
  @Roles('coach')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Creation d'un plan pour un utilisateur rattache (coach)",
  })
  @ApiBody({ type: CreatePlanDto })
  @ApiResponse({ status: 201, description: 'Plan cree, statut actif' })
  @ApiResponse({
    status: 400,
    description: 'Donnees ou regles metier invalides',
  })
  @ApiResponse({
    status: 403,
    description: 'Utilisateur non rattache a ce coach',
  })
  @ApiResponse({ status: 409, description: 'Un plan actif existe deja' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createPlanSchema)) body: CreatePlanDto,
  ) {
    const plan = await this.createPlanUseCase.execute({
      coachId: req.user.sub,
      userId: body.userId,
      poidsDepart: body.poidsDepart,
      poidsCible: body.poidsCible,
      dateDebut: body.dateDebut,
      dateCible: body.dateCible,
      niveauActivite: body.niveauActivite,
      budgetCalorique: body.budgetCalorique,
    });
    return plan.toProps();
  }

  @Get('me')
  @Roles('utilisateur')
  @ApiOperation({ summary: "Plan actif de l'utilisateur connecte" })
  @ApiResponse({ status: 200, description: 'Plan actif, ou null si aucun' })
  async getMine(@Req() req: AuthenticatedRequest) {
    const plan = await this.getCurrentPlanUseCase.execute({
      requesterId: req.user.sub,
      requesterRole: req.user.role,
      targetUserId: req.user.sub,
    });
    return plan ? plan.toProps() : null;
  }

  @Get('users/:userId')
  @Roles('coach')
  @ApiOperation({ summary: "Plan actif d'un utilisateur rattache (coach)" })
  @ApiResponse({ status: 200, description: 'Plan actif, ou null si aucun' })
  @ApiResponse({
    status: 403,
    description: 'Utilisateur non rattache a ce coach',
  })
  async getForUser(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    const plan = await this.getCurrentPlanUseCase.execute({
      requesterId: req.user.sub,
      requesterRole: req.user.role,
      targetUserId: userId,
    });
    return plan ? plan.toProps() : null;
  }

  @Post(':id/cancel')
  @Roles('coach')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Annulation manuelle d'un plan actif (coach)" })
  @ApiResponse({ status: 200, description: 'Plan annule' })
  @ApiResponse({ status: 403, description: 'Plan non rattache a ce coach' })
  @ApiResponse({ status: 404, description: 'Plan introuvable' })
  @ApiResponse({ status: 409, description: "Le plan n'est plus actif" })
  async cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const plan = await this.cancelPlanUseCase.execute({
      coachId: req.user.sub,
      planId: id,
    });
    return plan.toProps();
  }
}
