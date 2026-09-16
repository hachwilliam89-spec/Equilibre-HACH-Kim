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
        // Condition sur "development" et non sur "pas production" : les
        // environnements test et production utilisent tous deux l'image
        // construite avec --prod, d'ou pino-pretty (devDependency) est absent.
        // Tester NODE_ENV !== 'production' faisait planter l'API de test au
        // demarrage sur un transport introuvable.
        const isDev = configService.get<string>('NODE_ENV') === 'development';
        return {
          pinoHttp: {
            level: isDev ? 'debug' : 'info',
            // pino-pretty n'est installe qu'en devDependency : charge uniquement
            // en developpement, ou l'image contient les devDependencies.
            transport: isDev
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
            // Jamais loguer un secret, un token ou un mot de passe en clair,
            // meme accidentellement via une requete qui echoue.
            // Le healthcheck sonde toutes les 30s : inutile de le journaliser.
            autoLogging: {
              ignore: (req: { url?: string }) => req.url === '/api/health',
            },
            // Par defaut pino-http serialise toute la requete et toute la
            // reponse, en-tetes Helmet compris. On ne garde que l'utile ;
            // le detail complet des erreurs passe par AllExceptionsFilter.
            serializers: {
              req: (req: { id: unknown; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode: number }) => ({
                statusCode: res.statusCode,
              }),
            },
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
