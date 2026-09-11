import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import {
  LoginDto,
  loginSchema,
  RefreshTokenDto,
  refreshTokenSchema,
} from './dto/login.dto';
import { ZodValidationPipe } from './dto/zod-validation.pipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion coach ou utilisateur' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Connexion reussie, tokens retournes',
  })
  @ApiResponse({ status: 400, description: 'Donnees invalides (voir errors)' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginDto) {
    return this.loginUseCase.execute(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Renouvellement de l'access token" })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Nouvel access token' })
  @ApiResponse({ status: 401, description: 'Refresh token invalide ou expire' })
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenDto,
  ) {
    return this.refreshTokenUseCase.execute(body.refreshToken);
  }
}
