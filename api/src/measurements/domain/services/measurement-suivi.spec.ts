import { determinerSuivi } from './measurement-suivi';

// Plan 80 -> 70 kg sur 10 jours : poids attendu 75 au 2026-01-06.
const plan = {
  poidsDepart: 80,
  poidsCible: 70,
  dateDebut: new Date('2026-01-01T00:00:00Z'),
  dateCible: new Date('2026-01-11T00:00:00Z'),
};

describe('determinerSuivi (FR403-675)', () => {
  it('est en attente de premiere mesure sans mesure valide', () => {
    const suivi = determinerSuivi({
      plan,
      jourCourantUtc: '2026-01-06',
      derniereValide: null,
    });
    expect(suivi.statut).toBe('en-attente-premiere-mesure');
    expect(suivi.ecart).toBeNull();
  });

  it('est dans les clous quand la mesure du jour suit la trajectoire', () => {
    const suivi = determinerSuivi({
      plan,
      jourCourantUtc: '2026-01-06',
      derniereValide: { jourUtc: '2026-01-06', poidsKg: 75 },
    });
    expect(suivi.statut).toBe('dans-les-clous');
    expect(suivi.ecart?.dansLesClous).toBe(true);
  });

  it('reste a jour avec une mesure de la veille (un jour)', () => {
    const suivi = determinerSuivi({
      plan,
      jourCourantUtc: '2026-01-07',
      derniereValide: { jourUtc: '2026-01-06', poidsKg: 75 },
    });
    expect(suivi.statut).toBe('dans-les-clous');
  });

  it('detecte un ecart hors tolerance', () => {
    const suivi = determinerSuivi({
      plan,
      jourCourantUtc: '2026-01-06',
      derniereValide: { jourUtc: '2026-01-06', poidsKg: 78 },
    });
    expect(suivi.statut).toBe('ecart-detecte');
    expect(suivi.ecart?.ecartKg).toBeCloseTo(3, 6);
  });

  it('signale pas de donnees recentes au-dela d un jour', () => {
    const suivi = determinerSuivi({
      plan,
      jourCourantUtc: '2026-01-08',
      derniereValide: { jourUtc: '2026-01-06', poidsKg: 75 },
    });
    expect(suivi.statut).toBe('pas-de-donnees-recentes');
    expect(suivi.ecart).toBeNull();
  });
});
