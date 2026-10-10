import { RefreshTokenRecord } from '../entities/refresh-token-record.entity';

export interface RefreshTokenRepositoryPort {
  save: (record: RefreshTokenRecord) => Promise<RefreshTokenRecord>;
  findByTokenHash: (tokenHash: string) => Promise<RefreshTokenRecord | null>;
  // true si un enregistrement encore valide (ni revoque, ni expire) a
  // ete revoque ; false sinon (deja revoque, expire, ou inexistant). Permet
  // a l'appelant de detecter une consommation concurrente du meme jeton.
  revokeByTokenHash: (tokenHash: string) => Promise<boolean>;
  /** Révoque tous les refresh tokens encore actifs d'un utilisateur ; renvoie leur nombre. */
  revokeAllForUser: (userId: string) => Promise<number>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
