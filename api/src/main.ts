import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // bufferLogs: true evite de perdre les logs emis avant que le logger Pino
  // ne soit pleinement initialise (sinon NestFactory utilise son logger par
  // defaut pendant quelques millisecondes au tout debut du bootstrap).
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  app.use(helmet());
  // Swagger UI injecte un script inline pour demarrer son interface, ce que
  // la CSP stricte de Helmet bloque par defaut (page blanche). On desactive
  // juste la CSP sur cette route de documentation -- aucune donnee sensible
  // n'y transite, contrairement aux vraies routes API.
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }));

  app.setGlobalPrefix('api');
  // Le filtre d'exception global est maintenant enregistre via APP_FILTER
  // dans app.module.ts (pour beneficier de l'injection du logger Pino),
  // plus besoin de app.useGlobalFilters(new AllExceptionsFilter()) ici.

  const config = new DocumentBuilder()
    .setTitle('Equilibre API')
    .setDescription(
      'API du fil rouge 403 -- suivi de reequilibrage alimentaire',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(configService.get<number>('API_PORT') ?? 3000);
}

bootstrap().catch((err) => {
  console.error("Echec du demarrage de l'application :", err);
  process.exit(1);
});
