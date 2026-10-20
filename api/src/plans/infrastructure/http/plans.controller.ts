import { PreparePlanUseCase } from '../../application/use-cases/prepare-plan.use-case';
import { PlanPreviewDto } from './dto/plan-preview.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { RolesGuard } from '../../../common/auth/roles.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { CreatePlanUseCase } from '../../application/use-cases/create-plan.use-case';
import { GetCurrentPlanUseCase } from '../../application/use-cases/get-current-plan.use-case';
import { CancelPlanUseCase } from '../../application/use-cases/cancel-plan.use-case';
import { CreatePlanDto, createPlanSchema } from './dto/create-plan.dto';
import { UpdatePlanUseCase } from '../../application/use-cases/update-plan.use-case';
import { UpdatePlanDto, updatePlanSchema } from './dto/update-plan.dto';
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
    private readonly preparePlanUseCase: PreparePlanUseCase,
    private readonly createPlanUseCase: CreatePlanUseCase,
    private readonly getCurrentPlanUseCase: GetCurrentPlanUseCase,
    private readonly cancelPlanUseCase: CancelPlanUseCase,
    private readonly updatePlanUseCase: UpdatePlanUseCase,
  ) {}

  @Post('preview')
  @Roles('coach')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Calcul de la proposition sans enregistrement ni réservation de plan',
  })
  @ApiBody({ type: CreatePlanDto })
  @ApiResponse({
    status: 200,
    description: 'Proposition non enregistrée',
    type: PlanPreviewDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Données, profil ou règles métier invalides',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({
    status: 403,
    description: 'Rôle interdit ou utilisateur non rattaché',
  })
  async preview(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createPlanSchema)) body: CreatePlanDto,
  ): Promise<PlanPreviewDto> {
    const { plan, niveauActiviteSource, moyennePas7Jours } =
      await this.preparePlanUseCase.prepare({
        ...body,
        coachId: req.user.sub,
      });
    const props = plan.toProps();
    return {
      userId: props.userId,
      poidsDepart: props.poidsDepart,
      poidsCible: props.poidsCible,
      dateDebut: props.dateDebut.toISOString(),
      dateCible: props.dateCible.toISOString(),
      imcCible: props.imcCible,
      niveauActivite: props.niveauActivite,
      budgetCalorique: props.budgetCalorique,
      budgetPlafonneAuBmr: props.budgetPlafonneAuBmr,
      niveauActiviteSource,
      moyennePas7Jours,
      avertissement: props.budgetPlafonneAuBmr
        ? 'La suggestion a été ramenée au BMR ; elle ne correspond plus au déficit calculé pour le rythme demandé.'
        : null,
    };
  }

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
  async getMine(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const plan = await this.getCurrentPlanUseCase.execute({
      requesterId: req.user.sub,
      requesterRole: req.user.role,
      targetUserId: req.user.sub,
    });
    return res.json(plan ? plan.toProps() : null);
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
    @Res() res: Response,
  ) {
    const plan = await this.getCurrentPlanUseCase.execute({
      requesterId: req.user.sub,
      requesterRole: req.user.role,
      targetUserId: userId,
    });
    return res.json(plan ? plan.toProps() : null);
  }

  @Patch(':id')
  @Roles('coach')
  @ApiOperation({
    summary: "Ajustement du plan actif d'un utilisateur rattache (coach)",
    description:
      'Poids cible, date cible et/ou budget. Memes regles que la creation ; sans budget saisi, il est recalcule quand l’objectif change. Reinitialise la serie d’ecarts de la metrique ajustee (US5).',
  })
  @ApiBody({ type: UpdatePlanDto })
  @ApiResponse({ status: 200, description: 'Plan ajuste' })
  @ApiResponse({
    status: 400,
    description: 'Corps vide, donnees ou regles metier invalides',
  })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Plan non rattache a ce coach' })
  @ApiResponse({ status: 404, description: 'Plan introuvable' })
  @ApiResponse({
    status: 409,
    description: "Le plan n'est plus actif, ou modification simultanee",
  })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePlanSchema)) body: UpdatePlanDto,
  ) {
    const plan = await this.updatePlanUseCase.execute({
      coachId: req.user.sub,
      planId: id,
      ...body,
    });
    return plan.toProps();
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
