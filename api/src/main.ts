import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  // Swagger UI injecte un script inline pour demarrer son interface, ce que
  // la CSP stricte de Helmet bloque par defaut (page blanche, surtout sur
  // Safari). On desactive juste la CSP sur cette route de documentation --
  // aucune donnee sensible n'y transite, contrairement aux vraies routes API.
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }));

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());

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
