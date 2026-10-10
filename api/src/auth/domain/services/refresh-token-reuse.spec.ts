import { RefreshTokenRecord } from '../entities/refresh-token-record.entity';
import { estReutilisationSuspecte } from './refresh-token-reuse';

const maintenant = new Date('2026-10-10T08:00:00Z');
const record = (
  overrides: Partial<Parameters<typeof RefreshTokenRecord.create>[0]> = {},
) =>
  RefreshTokenRecord.create({
    id: 'id',
    userId: 'user',
    tokenHash: 'hash',
    expiresAt: new Date('2026-11-01T00:00:00Z'),
    revoked: true,
    revokedAt: new Date('2026-10-10T07:59:00Z'),
    createdAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  });

describe('estReutilisationSuspecte', () => {
  it('signale un jeton revoque depuis plus que le delai de grace', () => {
    expect(estReutilisationSuspecte(record(), maintenant, 30_000)).toBe(true);
  });

  it('tolere une reutilisation dans le delai de grace (requetes concurrentes)', () => {
    const recent = record({ revokedAt: new Date('2026-10-10T07:59:45Z') });
    expect(estReutilisationSuspecte(recent, maintenant, 30_000)).toBe(false);
  });

  it('ignore un jeton inconnu, encore valide ou expire', () => {
    expect(estReutilisationSuspecte(null, maintenant, 30_000)).toBe(false);
    expect(
      estReutilisationSuspecte(record({ revoked: false }), maintenant, 30_000),
    ).toBe(false);
    expect(
      estReutilisationSuspecte(
        record({ expiresAt: new Date('2026-10-09T00:00:00Z') }),
        maintenant,
        30_000,
      ),
    ).toBe(false);
  });

  it('traite un jeton revoque sans date (ancien format) comme suspect', () => {
    expect(
      estReutilisationSuspecte(
        record({ revokedAt: undefined }),
        maintenant,
        30_000,
      ),
    ).toBe(true);
  });
});
