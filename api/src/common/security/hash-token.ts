import { createHash } from 'crypto';

/**
 * Hachage deterministe (SHA-256) pour les refresh tokens.
 * Different de bcrypt (utilise pour les mots de passe) : bcrypt genere un
 * sel aleatoire a chaque appel, ce qui rend impossible une recherche directe
 * en base par egalite de hash. Les refresh tokens sont deja des chaines a
 * haute entropie (signes JWT) -- un hachage rapide et deterministe suffit
 * pour les retrouver en base sans jamais stocker le token en clair.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
