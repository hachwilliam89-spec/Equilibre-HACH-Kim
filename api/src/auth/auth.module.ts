import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { AuthController } from './infrastructure/http/auth.controller';
import { JwtStrategy } from './infrastructure/http/jwt.strategy';
import { MongooseUserRepository } from './infrastructure/persistence/mongoose-user.repository';
import {
  UserDocumentClass,
  UserSchema,
} from './infrastructure/persistence/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserDocumentClass.name, schema: UserSchema },
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        // Les durées d'expiration (15m / 7j) sont fixées explicitement dans chaque
        // use case au moment du sign(), pas ici globalement.
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Le domaine ne connaît que le port (l'interface) ; Mongoose est l'implémentation
    // concrète branchée ici, au niveau du module — pas ailleurs.
    { provide: USER_REPOSITORY, useClass: MongooseUserRepository },
    LoginUseCase,
    RefreshTokenUseCase,
    JwtStrategy,
  ],
  exports: [USER_REPOSITORY], // pour que plans/suivi puissent identifier un utilisateur si besoin
})
export class AuthModule {}
