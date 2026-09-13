import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // Swagger UI sert ses assets depuis la meme origine.
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          // upgrade-insecure-requests bascule toutes les sous-ressources en
          // HTTPS. En HTTP local cela casse le chargement des assets de
          // Swagger sous Safari, qui n'exempte pas localhost contrairement a
          // Chrome : la page reste blanche. Active uniquement en production.
          'upgrade-insecure-requests': isProduction ? [] : null,
        },
      },
      // HSTS n'a de sens que derriere HTTPS. En local il est inutile, et
      // Safari le met en cache, ce qui rend le probleme persistant meme
      // apres correction.
      strictTransportSecurity: isProduction,
    }),
  );

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Equilibre API')
    .setDescription(
      'API du fil rouge 403 -- suivi de reequilibrage alimentaire',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // nestjs-zod v5 : cleanupOpenApiDoc() remplace l'ancien patchNestJsSwagger().
  // Il se passe desormais sur le document deja genere, pas avant sa creation.
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document));

  // Port interne du conteneur. API_PORT, lui, est le port publie cote hote
  // par docker-compose ; il ne doit pas piloter l'ecoute de l'application.
  await app.listen(configService.get<number>('PORT') ?? 3000);
}

bootstrap().catch((err) => {
  console.error("Echec du demarrage de l'application :", err);
  process.exit(1);
});
