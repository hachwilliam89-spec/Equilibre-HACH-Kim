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

  app.use(helmet());
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }));

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

  await app.listen(configService.get<number>('API_PORT') ?? 3000);
}

bootstrap().catch((err) => {
  console.error("Echec du demarrage de l'application :", err);
  process.exit(1);
});
