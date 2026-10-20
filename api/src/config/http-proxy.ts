import type { NestExpressApplication } from '@nestjs/platform-express';

/** Express ne lit X-Forwarded-For que depuis les proxys explicitement fiables. */
export function configureTrustedProxy(
  app: NestExpressApplication,
  trustedProxyIps: string[],
): void {
  app.set('trust proxy', trustedProxyIps.length ? trustedProxyIps : false);
}
