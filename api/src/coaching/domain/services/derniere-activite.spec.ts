import { derniereActivite } from './derniere-activite';

describe('derniereActivite', () => {
  it('renvoie la date la plus recente', () => {
    const pesee = new Date('2026-10-07T06:00:00Z');
    const repas = new Date('2026-10-08T12:30:00Z');

    expect(derniereActivite([pesee, repas])?.toISOString()).toBe(
      '2026-10-08T12:30:00.000Z',
    );
  });

  it('ignore les dates absentes ou invalides', () => {
    const pesee = new Date('2026-10-07T06:00:00Z');

    expect(
      derniereActivite([null, undefined, new Date('invalide'), pesee]),
    ).toEqual(pesee);
  });

  it('renvoie null sans aucune activite', () => {
    expect(derniereActivite([])).toBeNull();
    expect(derniereActivite([null, undefined])).toBeNull();
  });

  it('renvoie une copie (pas la date fournie)', () => {
    const pesee = new Date('2026-10-07T06:00:00Z');
    const resultat = derniereActivite([pesee]);
    resultat?.setUTCFullYear(2000);

    expect(pesee.getUTCFullYear()).toBe(2026);
  });
});
