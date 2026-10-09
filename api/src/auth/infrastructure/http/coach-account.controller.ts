import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CoachAccountUseCase } from '../../application/use-cases/coach-account.use-case';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload } from './jwt.strategy';
import { UpdateIdentityDto, updateIdentitySchema } from './dto/identity.dto';
import { ZodValidationPipe } from './dto/zod-validation.pipe';

class CoachAccountDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false }) prenom?: string;
  @ApiProperty({ required: false }) nom?: string;
  @ApiProperty({ example: 'EQ-7A9B2C4D' }) coachCode: string;
}

@ApiTags('coach')
@ApiBearerAuth()
@Controller('coach/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('coach')
export class CoachAccountController {
  constructor(private readonly account: CoachAccountUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Compte du coach connecte' })
  @ApiResponse({ status: 200, type: CoachAccountDto })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Role coach requis' })
  get(@Req() request: Request & { user: JwtPayload }) {
    return this.account.get(request.user.sub);
  }

  @Patch()
  @ApiOperation({ summary: 'Modification du prenom et du nom du coach' })
  @ApiResponse({ status: 200, type: CoachAccountDto })
  @ApiResponse({ status: 400, description: 'Identite invalide (voir errors)' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Role coach requis' })
  update(
    @Req() request: Request & { user: JwtPayload },
    @Body(new ZodValidationPipe(updateIdentitySchema)) body: UpdateIdentityDto,
  ) {
    return this.account.updateIdentity(request.user.sub, body);
  }
}
