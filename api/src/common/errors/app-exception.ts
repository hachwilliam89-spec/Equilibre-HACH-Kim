import { HttpException, HttpStatus } from '@nestjs/common';

// Base des URI de type d'erreur -- n'a pas besoin de resoudre vers une vraie
// page pour ce projet, la RFC 7807 exige juste un identifiant stable, pas
// necessairement une ressource accessible.
const PROBLEM_BASE_URI = 'https://equilibre.app/problems';

/**
 * Exception métier conforme RFC 7807 (Problem Details for HTTP APIs).
 * A utiliser dans les use cases pour toute règle métier précise.
 *
 * Exemple : throw new AppException('plan-already-active', 'Un plan actif existe deja', HttpStatus.CONFLICT);
 */
export class AppException extends HttpException {
  constructor(
    slug: string,
    title: string,
    status: HttpStatus,
    detail?: string,
  ) {
    super(
      {
        type: `${PROBLEM_BASE_URI}/${slug}`,
        title,
        status,
        detail: detail ?? title,
      },
      status,
    );
  }
}
