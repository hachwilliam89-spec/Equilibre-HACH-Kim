import {
  TOLERANCE_ECART_KG,
  evaluerEcart,
  poidsAttendu,
} from './measurement-trajectory';

// Plan de reference : 80 kg -> 70 kg sur 10 jours civils UTC.
const plan = {
  poidsDepart: 80,
  poidsCible: 70,
  dateDebut: new Date('2026-01-01T00:00:00Z'),
  dateCible: new Date('2026-01-11T00:00:00Z'),
};

describe('poidsAttendu (FR403-673)', () => {
  it('vaut le poids de depart au premier jour', () => {
    expect(poidsAttendu(plan, '2026-01-01')).toBeCloseTo(80, 6);
  });

  it('vaut le poids cible au dernier jour', () => {
    expect(poidsAttendu(plan, '2026-01-11')).toBeCloseTo(70, 6);
  });

  it('interpole lineairement a mi-parcours', () => {
    // 5 jours / 10 -> ratio 0.5 -> 75 kg
    expect(poidsAttendu(plan, '2026-01-06')).toBeCloseTo(75, 6);
  });

  it('interpole aussi pour une prise de poids', () => {
    const prise = {
      poidsDepart: 70,
      poidsCible: 72,
      dateDebut: new Date('2026-03-01T00:00:00Z'),
      dateCible: new Date('2026-03-05T00:00:00Z'),
    };
    // 1 jour / 4 -> +0.5 kg
    expect(poidsAttendu(prise, '2026-03-02')).toBeCloseTo(70.5, 6);
  });
});

describe('evaluerEcart (FR403-673)', () => {
  it('est dans les clous quand la mesure suit la trajectoire', () => {
    const resultat = evaluerEcart(plan, '2026-01-06', 75);
    expect(resultat.poidsAttendu).toBeCloseTo(75, 6);
    expect(resultat.ecartKg).toBeCloseTo(0, 6);
    expect(resultat.dansLesClous).toBe(true);
  });

  it('accepte la borne exacte de tolerance (1 kg)', () => {
    expect(evaluerEcart(plan, '2026-01-06', 76).dansLesClous).toBe(true);
    expect(evaluerEcart(plan, '2026-01-06', 74).dansLesClous).toBe(true);
  });

  it('detecte un ecart au-dela de la tolerance', () => {
    const resultat = evaluerEcart(plan, '2026-01-06', 78);
    expect(resultat.ecartKg).toBeCloseTo(3, 6);
    expect(resultat.dansLesClous).toBe(false);
  });

  it('conserve le signe de l ecart (mesure moins attendu)', () => {
    expect(evaluerEcart(plan, '2026-01-06', 73).ecartKg).toBeCloseTo(-2, 6);
  });

  it('expose la tolerance metier a 1 kg', () => {
    expect(TOLERANCE_ECART_KG).toBe(1);
  });
});
