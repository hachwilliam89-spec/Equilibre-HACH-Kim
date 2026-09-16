import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
import { REFRESH_TOKEN_REPOSITORY } from './domain/ports/refresh-token-repository.port';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { AuthController } from './infrastructure/http/auth.controller';
import { JwtStrategy } from './infrastructure/http/jwt.strategy';
import { MongooseUserRepository } from './infrastructure/persistence/mongoose-user.repository';
import {
  UserDocumentClass,
  UserSchema,
} from './infrastructure/persistence/user.schema';
import { MongooseRefreshTokenRepository } from './infrastructure/persistence/mongoose-refresh-token.repository';
import {
  RefreshTokenDocumentClass,
  RefreshTokenSchema,
} from './infrastructure/persistence/refresh-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserDocumentClass.name, schema: UserSchema },
      { name: RefreshTokenDocumentClass.name, schema: RefreshTokenSchema },
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: USER_REPOSITORY, useClass: MongooseUserRepository },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: MongooseRefreshTokenRepository,
    },
    LoginUseCase,
    RefreshTokenUseCase,
    RegisterUseCase,
    LogoutUseCase,
    JwtStrategy,
  ],
  exports: [USER_REPOSITORY],
})
export class AuthModule {}
