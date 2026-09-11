import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/env.schema';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProd = configService.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            // pino-pretty n'est installe qu'en devDependency : jamais charge en prod
            transport: isProd
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
            // Jamais loguer un secret, un token ou un mot de passe en clair,
            // meme accidentellement via une requete qui echoue.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.refreshToken',
                'res.headers["set-cookie"]',
              ],
              censor: '**REDACTED**',
            },
          },
        };
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    AuthModule,
    HealthModule,
    // Les modules plans et suivi viendront s'ajouter ici ensuite
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Enregistre le filtre comme provider Nest plutot que "new" dans main.ts,
    // pour qu'il beneficie de l'injection de dependances (le logger Pino).
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
