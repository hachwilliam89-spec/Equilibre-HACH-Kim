import {
  SEUIL_SUSPECT_KG,
  classifyMeasurement,
} from './measurement-classification';

// Plan de reference : periode du 2026-01-01 au 2026-01-31.
const base = {
  poidsKg: 80,
  planDateDebutJourUtc: '2026-01-01',
  planDateCibleJourUtc: '2026-01-31',
  poidsValideVeille: null as number | null,
};

describe('classifyMeasurement (FR403-672)', () => {
  it('classe valide dans la periode sans mesure de la veille', () => {
    expect(classifyMeasurement({ ...base, jourUtc: '2026-01-10' })).toBe(
      'valide',
    );
  });

  it('classe valide quand l ecart avec la veille reste sous le seuil', () => {
    expect(
      classifyMeasurement({
        ...base,
        jourUtc: '2026-01-10',
        poidsValideVeille: 78,
      }),
    ).toBe('valide');
  });

  it('accepte la borne exacte de 3 kg sans flaguer suspecte', () => {
    expect(
      classifyMeasurement({
        ...base,
        poidsKg: 81,
        jourUtc: '2026-01-10',
        poidsValideVeille: 78,
      }),
    ).toBe('valide');
  });

  it('classe suspecte au-dela de 3 kg d ecart avec la veille', () => {
    expect(
      classifyMeasurement({
        ...base,
        poidsKg: 82,
        jourUtc: '2026-01-10',
        poidsValideVeille: 78,
      }),
    ).toBe('suspecte');
  });

  it('classe hors-plan avant le debut du plan', () => {
    expect(classifyMeasurement({ ...base, jourUtc: '2025-12-31' })).toBe(
      'hors-plan',
    );
  });

  it('classe hors-plan apres la date cible', () => {
    expect(classifyMeasurement({ ...base, jourUtc: '2026-02-01' })).toBe(
      'hors-plan',
    );
  });

  it('donne la priorite a hors-plan sur suspecte', () => {
    expect(
      classifyMeasurement({
        ...base,
        poidsKg: 82,
        jourUtc: '2025-12-31',
        poidsValideVeille: 78,
      }),
    ).toBe('hors-plan');
  });

  it('inclut les bornes de la periode (debut et cible)', () => {
    expect(classifyMeasurement({ ...base, jourUtc: '2026-01-01' })).toBe(
      'valide',
    );
    expect(classifyMeasurement({ ...base, jourUtc: '2026-01-31' })).toBe(
      'valide',
    );
  });

  it('expose le seuil suspect a 3 kg', () => {
    expect(SEUIL_SUSPECT_KG).toBe(3);
  });
});
