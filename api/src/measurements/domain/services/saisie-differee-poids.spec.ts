import { verifierSaisieDiffereePoids } from './saisie-differee-poids';

const maintenant = new Date('2026-10-06T12:00:00Z');

describe('verifierSaisieDiffereePoids', () => {
  it('accepte une saisie hors ligne du même jour UTC', () => {
    expect(
      verifierSaisieDiffereePoids(new Date('2026-10-06T06:15:00Z'), maintenant),
    ).toBeNull();
  });

  it('refuse une saisie de la veille : le secours ne vaut que le jour même', () => {
    expect(
      verifierSaisieDiffereePoids(new Date('2026-10-05T23:59:00Z'), maintenant),
    ).toBe('saisie-poids-expiree');
  });

  it('refuse une saisie datée dans le futur au-delà de la tolérance', () => {
    expect(
      verifierSaisieDiffereePoids(new Date('2026-10-06T12:10:00Z'), maintenant),
    ).toBe('saisie-dans-le-futur');
  });
});
