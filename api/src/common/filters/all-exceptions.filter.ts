import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
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
  errors?: FieldError[]; // extension member, autorisee par la RFC
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
 * Filtre d'exception global, branche une seule fois dans main.ts.
 * Formate TOUTE reponse d'erreur selon la RFC 7807 (application/problem+json),
 * avec un "type" stable que le mobile peut utiliser sans parser le texte francais.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = isHttpException ? exception.getResponse() : null;

    let type = 'about:blank'; // valeur par defaut RFC 7807 quand aucun type specifique
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

    // Les erreurs 500 non prevues meritent d'etre loguees cote serveur.
    // TODO : remplacer par le logger Pino une fois cable.
    if (status >= 500) {
      console.error(exception);
    }

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problem);
  }
}
