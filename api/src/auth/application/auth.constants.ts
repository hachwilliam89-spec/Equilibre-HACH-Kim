const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Durée de vie d'un refresh token. Chaque renouvellement en émet un nouveau
 * pour la même durée : un utilisateur actif reste connecté (session glissante).
 */
export const REFRESH_TOKEN_TTL_MS = 30 * JOUR_MS;
export const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_MS / 1000;

/**
 * Délai pendant lequel la réutilisation d'un refresh token tout juste
 * renouvelé est tolérée (requêtes concurrentes d'un même appareil). Au-delà,
 * elle est traitée comme un vol de jeton.
 */
export const REFRESH_REUSE_GRACE_MS = 30 * 1000;
