import type { RefreshTokenRecord } from '../entities/refresh-token-record.entity';

/**
 * Un refresh token déjà révoqué qui revient après le délai de grâce est
 * suspect : son propriétaire légitime l'a déjà échangé (ou s'est déconnecté),
 * c'est donc probablement une copie volée.
 */
export function estReutilisationSuspecte(
  record: RefreshTokenRecord | null,
  maintenant: Date,
  delaiDeGraceMs: number,
): boolean {
  if (!record || !record.revoked) return false;
  if (record.expiresAt.getTime() <= maintenant.getTime()) return false;
  const revokedAt = record.revokedAt;
  if (!revokedAt) return true;
  return maintenant.getTime() - revokedAt.getTime() > delaiDeGraceMs;
}
