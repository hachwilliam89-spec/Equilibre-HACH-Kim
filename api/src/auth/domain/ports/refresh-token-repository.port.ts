import { RefreshTokenRecord } from '../entities/refresh-token-record.entity';

export interface RefreshTokenRepositoryPort {
  save(record: RefreshTokenRecord): Promise<RefreshTokenRecord>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
