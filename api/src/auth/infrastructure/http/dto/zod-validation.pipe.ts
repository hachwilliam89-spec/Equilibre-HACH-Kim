import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Pipe generique : valide le body d'une requete contre un schema Zod.
 * Reponse conforme RFC 7807 en cas d'echec.
 * Usage : @Body(new ZodValidationPipe(loginSchema)) body: LoginDto
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fieldErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(racine)',
        message: issue.message,
      }));

      throw new BadRequestException({
        type: 'https://equilibre.app/problems/validation-error',
        title: 'Donnees invalides',
        detail: `${fieldErrors.length} champ(s) invalide(s)`,
        errors: fieldErrors,
      });
    }
    return result.data;
  }
}
