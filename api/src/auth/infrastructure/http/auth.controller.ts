import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import {
  LoginDto,
  loginSchema,
  RefreshTokenDto,
  refreshTokenSchema,
} from './dto/login.dto';
import { RegisterDto, registerSchema } from './dto/register.dto';
import { ZodValidationPipe } from './dto/zod-validation.pipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Creation de compte (coach ou utilisateur)' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Compte cree' })
  @ApiResponse({ status: 400, description: 'Donnees invalides (voir errors)' })
  @ApiResponse({ status: 409, description: 'Email deja utilise' })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterDto,
  ) {
    return this.registerUseCase.execute(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Anti brute-force : plus strict que la limite globale (100/min), vu la
  // sensibilite de cette route (tentatives de mot de passe).
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
  @ApiOperation({
    summary: "Renouvellement de l'access token (rotation du refresh token)",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description:
      "Nouvel access token et nouveau refresh token -- l'ancien est revoque",
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token invalide, expire ou revoque',
  })
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenDto,
  ) {
    return this.refreshTokenUseCase.execute(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deconnexion -- revoque le refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 204,
    description: 'Deconnexion effectuee (idempotent)',
  })
  async logout(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenDto,
  ) {
    await this.logoutUseCase.execute(body.refreshToken);
  }
}
