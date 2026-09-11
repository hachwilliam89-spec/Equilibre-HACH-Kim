import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Request, Response } from 'express';

interface FieldError {
  field: string;
  message: string;
}

// Structure conforme RFC 7807 (Problem Details for HTTP APIs)
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: FieldError[];
}

const DEFAULT_TITLES: Record<number, string> = {
  400: 'Requete invalide',
  401: 'Non autorise',
  403: 'Acces refuse',
  404: 'Ressource introuvable',
  409: 'Conflit',
  500: 'Erreur interne',
};

/**
 * Filtre d'exception global, enregistre via APP_FILTER dans app.module.ts
 * (pas "new" dans main.ts) pour beneficier de l'injection de dependances,
 * notamment le logger Pino ci-dessous.
 * Formate TOUTE reponse d'erreur selon la RFC 7807.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = isHttpException ? exception.getResponse() : null;

    let type = 'about:blank';
    let title: string;
    let detail: string;
    let errors: FieldError[] | undefined;

    if (typeof rawResponse === 'string') {
      title = DEFAULT_TITLES[status] ?? 'Erreur';
      detail = rawResponse;
    } else if (rawResponse && typeof rawResponse === 'object') {
      const body = rawResponse as Record<string, unknown>;
      type = (body.type as string) ?? type;
      title = (body.title as string) ?? DEFAULT_TITLES[status] ?? 'Erreur';
      detail = (body.detail as string) ?? title;
      errors = body.errors as FieldError[] | undefined;
    } else {
      title = 'Erreur interne';
      detail = 'Une erreur interne est survenue';
    }

    const problem: ProblemDetails = {
      type,
      title,
      status,
      detail,
      instance: request.url,
      ...(errors ? { errors } : {}),
    };

    // Les erreurs 500 non prevues sont de vraies anomalies a investiguer.
    // Les 4xx (mauvaise requete, mauvais identifiants...) sont attendues et
    // n'ont pas besoin de polluer les logs au niveau error.
    if (status >= 500) {
      this.logger.error(
        { err: exception, path: request.url },
        'Erreur interne non geree',
      );
    } else {
      this.logger.debug(
        { status, path: request.url, title },
        'Requete rejetee',
      );
    }

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problem);
  }
}
