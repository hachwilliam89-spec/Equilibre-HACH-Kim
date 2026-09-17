import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';

/**
 * Cible du HEALTHCHECK du Dockerfile (wget --spider http://localhost:3000/api/health).
 * Verifie non seulement que l'API repond, mais aussi que Mongo est joignable --
 * un conteneur "healthy" avec une base injoignable ne servirait a rien.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: "Etat de sante de l'API (connexion Mongo incluse)" })
  check() {
    return this.health.check([() => this.mongoose.pingCheck('mongo')]);
  }
}
