import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { GetOwnProfileUseCase } from '../../application/use-cases/get-own-profile.use-case';
import { UpdateOwnProfileUseCase } from '../../application/use-cases/update-own-profile.use-case';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload } from './jwt.strategy';
import {
  UpdateProfileDto,
  updateProfileSchema,
} from './dto/update-profile.dto';
import { ZodValidationPipe } from './dto/zod-validation.pipe';

class CoachSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false }) prenom?: string;
  @ApiProperty({ required: false }) nom?: string;
}

class OwnProfileDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false }) prenom?: string;
  @ApiProperty({ required: false }) nom?: string;
  @ApiProperty({ type: CoachSummaryDto }) coach: CoachSummaryDto;
  @ApiProperty({ required: false }) tailleCm?: number;
  @ApiProperty({ required: false }) age?: number;
  @ApiProperty({ required: false, enum: ['homme', 'femme'] }) sexe?:
    'homme' | 'femme';
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('utilisateur')
export class UserProfileController {
  constructor(
    private readonly getOwnProfile: GetOwnProfileUseCase,
    private readonly updateOwnProfile: UpdateOwnProfileUseCase,
  ) {}

  @Get('me')
  @ApiOperation({ summary: "Profil de l'utilisateur connecte" })
  @ApiResponse({ status: 200, type: OwnProfileDto })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Role utilisateur requis' })
  get(@Req() request: Request & { user: JwtPayload }) {
    return this.getOwnProfile.execute(request.user.sub);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: "Modification du profil de l'utilisateur connecte" })
  @ApiResponse({ status: 200, type: OwnProfileDto })
  @ApiResponse({ status: 400, description: 'Profil invalide (voir errors)' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Role utilisateur requis' })
  update(
    @Req() request: Request & { user: JwtPayload },
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileDto,
  ) {
    return this.updateOwnProfile.execute(request.user.sub, body);
  }
}
