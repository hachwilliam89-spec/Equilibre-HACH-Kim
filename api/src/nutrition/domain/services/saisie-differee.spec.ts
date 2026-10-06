import {
  ANCIENNETE_MAX_JOURS,
  horodatageRetenu,
  verifierSaisieDiffereeAliment,
} from './saisie-differee';

const plan = {
  dateDebut: new Date('2026-09-01T00:00:00Z'),
  dateCible: new Date('2026-12-31T00:00:00Z'),
};
const maintenant = new Date('2026-10-06T12:00:00Z');

describe('verifierSaisieDiffereeAliment', () => {
  it('accepte une entrée saisie hors ligne la veille au soir', () => {
    expect(
      verifierSaisieDiffereeAliment(
        new Date('2026-10-05T21:30:00Z'),
        maintenant,
        plan,
      ),
    ).toBeNull();
  });

  it("tolère une horloge d'appareil légèrement en avance", () => {
    expect(
      verifierSaisieDiffereeAliment(
        new Date('2026-10-06T12:04:00Z'),
        maintenant,
        plan,
      ),
    ).toBeNull();
  });

  it('refuse une entrée datée dans le futur au-delà de la tolérance', () => {
    expect(
      verifierSaisieDiffereeAliment(
        new Date('2026-10-06T12:06:00Z'),
        maintenant,
        plan,
      ),
    ).toBe('saisie-dans-le-futur');
  });

  it(`accepte jusqu'à J-${ANCIENNETE_MAX_JOURS} et refuse au-delà`, () => {
    expect(
      verifierSaisieDiffereeAliment(
        new Date('2026-09-29T08:00:00Z'),
        maintenant,
        plan,
      ),
    ).toBeNull();
    expect(
      verifierSaisieDiffereeAliment(
        new Date('2026-09-28T23:59:00Z'),
        maintenant,
        plan,
      ),
    ).toBe('saisie-trop-ancienne');
  });

  it('refuse une entrée antérieure au début du plan', () => {
    expect(
      verifierSaisieDiffereeAliment(
        new Date('2026-10-02T10:00:00Z'),
        maintenant,
        { ...plan, dateDebut: new Date('2026-10-03T00:00:00Z') },
      ),
    ).toBe('saisie-hors-plan');
  });

  it('refuse un horodatage invalide', () => {
    expect(
      verifierSaisieDiffereeAliment(new Date('invalide'), maintenant, plan),
    ).toBe('saisie-dans-le-futur');
  });
});

describe('horodatageRetenu', () => {
  it("ramène une avance tolérée à l'instant serveur", () => {
    expect(
      horodatageRetenu(new Date('2026-10-06T12:03:00Z'), maintenant),
    ).toEqual(maintenant);
  });

  it("conserve l'heure de consommation passée", () => {
    const hier = new Date('2026-10-05T21:30:00Z');
    expect(horodatageRetenu(hier, maintenant)).toEqual(hier);
  });
});
